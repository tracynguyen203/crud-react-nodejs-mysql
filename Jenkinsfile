def waitForHttp(String url) {
    withEnv(["CHECK_URL=${url}"]) {
        powershell '''
            $ok = $false
            for ($i = 1; $i -le 40; $i++) {
                try {
                    $r = Invoke-WebRequest -Uri $env:CHECK_URL -UseBasicParsing -TimeoutSec 5
                    Write-Host "UP - HTTP $($r.StatusCode)"
                    $ok = $true; break
                } catch {
                    if ($_.Exception.Response) {
                        $code = [int]$_.Exception.Response.StatusCode
                        if ($code -lt 500) { Write-Host "UP - HTTP $code"; $ok = $true; break }
                    }
                    Write-Host "Waiting for $($env:CHECK_URL) (attempt $i of 40)..."
                    Start-Sleep -Seconds 3
                }
            }
            if (-not $ok) { Write-Error "Service did not become healthy"; exit 1 }
        '''
    }
}

def composeEnv(String apiImage, String webImage, String apiPort, String webPort) {
    return [
        "API_IMAGE=${apiImage}", "WEB_IMAGE=${webImage}",
        "API_PORT=${apiPort}",   "WEB_PORT=${webPort}",
        "API_PUBLIC_URL=http://localhost:${apiPort}",
        "WEB_PUBLIC_URL=http://localhost:${webPort}",
        "DB_USER=user"
    ]
}

def smokeTest(String project) {
    withEnv(["NET=${project}_default"]) {
        bat 'docker run --rm -i --network %NET% node:22-alpine node - http://crud-api:3001 http://crud-web:8080 < tests\\smoke.js'
    }
}

pipeline {
    agent any
    options {
        timestamps()
        timeout(time: 60, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    parameters {
        booleanParam(name: 'REQUIRE_APPROVAL', defaultValue: false,
                     description: 'Pause for manual approval before promoting to production')
    }

    environment {
        APP_NAME        = 'crud'
        IMAGE_TAG       = "${env.BUILD_NUMBER}"
        LOCAL_API       = "crud-api:${env.BUILD_NUMBER}"
        LOCAL_WEB       = "crud-web:${env.BUILD_NUMBER}"
        DH_NAMESPACE    = 'tracynguyen203'
        PROD_API        = "tracynguyen203/crud-api:${env.BUILD_NUMBER}"
        PROD_WEB        = "tracynguyen203/crud-web:${env.BUILD_NUMBER}"
        GITHUB_REPO     = 'github.com/tracynguyen203/crud-react-nodejs-mysql.git'
        SONAR_HOST_URL  = 'http://host.docker.internal:9000'
        KUMA_URL        = 'http://localhost:3001'
        STAGING_WEB     = '4000'
        STAGING_API     = '4100'
        PROD_WEB_PORT   = '3000'
        PROD_API_PORT   = '3100'
        DOCKER_BUILDKIT = '1'
    }

    stages {

        // Stage 1 
        stage('Build') {
            steps {
                bat 'git log -1 --oneline'
                bat 'docker version'
                // Build artefacts = two versioned Docker images (multi-stage Dockerfiles)
                bat 'docker build -t %LOCAL_API% -t crud-api:latest .\\api'
                bat 'docker build -t %LOCAL_WEB% -t crud-web:latest .\\web'
                bat '''
                    if not exist artifacts mkdir artifacts
                    docker image inspect %LOCAL_API% %LOCAL_WEB% > artifacts\\image-inspect.json
                    docker images crud-api > artifacts\\images.txt
                    docker images crud-web >> artifacts\\images.txt
                '''
            }
        }

        // Stage 2 
        stage('Test') {
            steps {
                bat 'if not exist reports\\api mkdir reports\\api'
                bat 'if not exist reports\\web mkdir reports\\web'
                bat '''
                    docker run --rm -v "%WORKSPACE%:/src:ro" -v "%WORKSPACE%/reports/api:/out" node:22-alpine sh /src/scripts/test-api.sh
                '''
                bat '''
                    docker run --rm -v "%WORKSPACE%:/src:ro" -v "%WORKSPACE%/reports/web:/out" node:22-alpine sh /src/scripts/test-web.sh
                '''
            }
            post {
                always { junit allowEmptyResults: true, testResults: 'reports/*/junit.xml' }
            }
        }

        // Stage 3 
        stage('Code Quality') {
            steps {
                withCredentials([string(credentialsId: 'sonarqube-token', variable: 'SONAR_TOKEN')]) {
                    catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                        bat '''
                            docker run --rm -e SONAR_HOST_URL=%SONAR_HOST_URL% -e SONAR_TOKEN -v "%WORKSPACE%:/usr/src" sonarsource/sonar-scanner-cli -Dsonar.projectBaseDir=/usr/src -Dsonar.projectVersion=%IMAGE_TAG% -Dsonar.qualitygate.wait=true
                        '''
                    }
                }
            }
        }

        // Stage 4 
        stage('Security') {
            steps {
                bat 'if not exist reports mkdir reports'
                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    bat '''
                        docker run --rm -v "%WORKSPACE%:/src:ro" -v "%WORKSPACE%/reports:/out" node:22-alpine sh /src/scripts/npm-audit.sh
                    '''
                }
                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    bat '''
                        docker run --rm -v trivy-cache:/root/.cache/ -v "%WORKSPACE%:/src:ro" -v "%WORKSPACE%/reports:/reports" aquasec/trivy:latest fs --scanners secret,misconfig --severity HIGH,CRITICAL --skip-dirs /src/reports --ignorefile /src/.trivyignore --no-progress --exit-code 1 --output /reports/trivy-fs.txt /src
                        set RC=%ERRORLEVEL%
                        if exist reports\\trivy-fs.txt type reports\\trivy-fs.txt
                        exit /b %RC%
                    '''
                }

                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    bat '''
                        docker run --rm -v //var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache/ -v "%WORKSPACE%:/src:ro" -v "%WORKSPACE%/reports:/reports" aquasec/trivy:latest image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --ignorefile /src/.trivyignore --no-progress --exit-code 1 --output /reports/trivy-api.txt %LOCAL_API%
                        set RC1=%ERRORLEVEL%
                        docker run --rm -v //var/run/docker.sock:/var/run/docker.sock -v trivy-cache:/root/.cache/ -v "%WORKSPACE%:/src:ro" -v "%WORKSPACE%/reports:/reports" aquasec/trivy:latest image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --ignorefile /src/.trivyignore --no-progress --exit-code 1 --output /reports/trivy-web.txt %LOCAL_WEB%
                        set RC2=%ERRORLEVEL%
                        if exist reports\\trivy-api.txt type reports\\trivy-api.txt
                        if exist reports\\trivy-web.txt type reports\\trivy-web.txt
                        if not "%RC1%"=="0" exit /b %RC1%
                        exit /b %RC2%
                    '''
                }
            }
        }

        // Stage 5 
        stage('Deploy') {
            steps {
                withEnv(composeEnv(env.LOCAL_API, env.LOCAL_WEB, env.STAGING_API, env.STAGING_WEB)) {
                    withCredentials([string(credentialsId: 'crud-db-root-password', variable: 'DB_ROOT_PASSWORD'),
                                     string(credentialsId: 'crud-db-password',      variable: 'DB_PASSWORD')]) {
                        bat 'docker compose -p crud-staging -f docker-compose.deploy.yml down -v --remove-orphans'
                        bat 'docker compose -p crud-staging -f docker-compose.deploy.yml up -d'
                        script { waitForHttp("http://localhost:${env.STAGING_WEB}/") }
                        bat 'docker compose -p crud-staging -f docker-compose.deploy.yml ps'
                        script { smokeTest('crud-staging') }
                    }
                }
            }
            post {
                failure {
                    withEnv(composeEnv(env.LOCAL_API, env.LOCAL_WEB, env.STAGING_API, env.STAGING_WEB)) {
                        withCredentials([string(credentialsId: 'crud-db-root-password', variable: 'DB_ROOT_PASSWORD'),
                                         string(credentialsId: 'crud-db-password',      variable: 'DB_PASSWORD')]) {
                            bat '''
                                docker compose -p crud-staging -f docker-compose.deploy.yml ps -a
                                docker compose -p crud-staging -f docker-compose.deploy.yml logs --tail 100
                                exit /b 0
                            '''
                        }
                    }
                }
            }
        }

        // Stage 6 
        stage('Release') {
            steps {
                script {
                    if (params.REQUIRE_APPROVAL) {
                        timeout(time: 1, unit: 'DAYS') {
                            input message: "Promote build #${env.BUILD_NUMBER} to PRODUCTION?", ok: 'Release'
                        }
                    }
                }

                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds',
                                                  usernameVariable: 'DH_USER',
                                                  passwordVariable: 'DH_PASS')]) {
                    powershell '''
                        $tmp = New-TemporaryFile
                        [System.IO.File]::WriteAllText($tmp.FullName, $env:DH_PASS)
                        cmd /c "docker login -u $($env:DH_USER) --password-stdin < `"$($tmp.FullName)`""
                        $rc = $LASTEXITCODE
                        Remove-Item $tmp.FullName -Force
                        if ($rc -ne 0) { exit 1 }
                        foreach ($app in @('api','web')) {
                            $local  = "crud-${app}:$($env:IMAGE_TAG)"
                            $remote = "$($env:DH_NAMESPACE)/crud-${app}"
                            docker tag $local "${remote}:$($env:IMAGE_TAG)"
                            docker tag $local "${remote}:latest"
                            docker push "${remote}:$($env:IMAGE_TAG)"
                            if ($LASTEXITCODE -ne 0) { exit 1 }
                            docker push "${remote}:latest"
                            if ($LASTEXITCODE -ne 0) { exit 1 }
                        }
                        docker logout
                    '''
                }

                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    withCredentials([usernamePassword(credentialsId: 'github-token',
                                                      usernameVariable: 'GH_USER',
                                                      passwordVariable: 'GH_PAT')]) {
                        powershell '''
                            $tag = "v1.0.$($env:BUILD_NUMBER)"
                            git config user.email "jenkins@local"
                            git config user.name "Jenkins"
                            git tag -f $tag
                            git push "https://$($env:GH_USER):$($env:GH_PAT)@$($env:GITHUB_REPO)" $tag --force
                            if ($LASTEXITCODE -ne 0) { exit 1 }
                        '''
                    }
                }

                script {
                    env.PREV_API = bat(returnStdout: true,
                        script: '@docker inspect --format "{{.Config.Image}}" crud-prod-crud-api-1 2>nul || exit /b 0').trim()
                    env.PREV_WEB = bat(returnStdout: true,
                        script: '@docker inspect --format "{{.Config.Image}}" crud-prod-crud-web-1 2>nul || exit /b 0').trim()

                    def deployProd = { String api, String web ->
                        withEnv(composeEnv(api, web, env.PROD_API_PORT, env.PROD_WEB_PORT)) {
                            withCredentials([string(credentialsId: 'crud-db-root-password', variable: 'DB_ROOT_PASSWORD'),
                                             string(credentialsId: 'crud-db-password',      variable: 'DB_PASSWORD')]) {
                                bat 'docker compose -p crud-prod -f docker-compose.deploy.yml pull crud-api crud-web'
                                bat 'docker compose -p crud-prod -f docker-compose.deploy.yml up -d'
                                waitForHttp("http://localhost:${env.PROD_WEB_PORT}/")
                                smokeTest('crud-prod')
                            }
                        }
                    }

                    try {
                        deployProd(env.PROD_API, env.PROD_WEB)
                    } catch (err) {
                        echo "Production verification FAILED: ${err}"
                        if (env.PREV_API?.trim() && env.PREV_WEB?.trim()) {
                            echo "Rolling back to ${env.PREV_API} / ${env.PREV_WEB}"
                            deployProd(env.PREV_API.trim(), env.PREV_WEB.trim())
                        }
                        throw err
                    }
                }
            }
        }

        // Stage 7 
        stage('Monitoring') {
            steps {
                script {
                    waitForHttp("http://localhost:${env.PROD_WEB_PORT}/")
                    waitForHttp("http://localhost:${env.PROD_API_PORT}/health")
                    waitForHttp("${env.KUMA_URL}/")
                }
                withCredentials([string(credentialsId: 'crud-kuma-push-token', variable: 'KUMA_TOKEN')]) {
                    powershell '''
                        $ErrorActionPreference = 'Stop'
                        $msg = [uri]::EscapeDataString("CRUD build $($env:BUILD_NUMBER) released to production")
                        $url = "$($env:KUMA_URL)/api/push/$($env:KUMA_TOKEN)?status=up&msg=$msg&ping="
                        $r = Invoke-RestMethod -Uri $url -TimeoutSec 15
                        Write-Host "Uptime Kuma heartbeat sent: $($r | ConvertTo-Json -Compress)"
                    '''
                }
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'reports/**,artifacts/**', allowEmptyArchive: true, fingerprint: true
        }
        success {
            echo "Pipeline OK - ${env.PROD_API} and ${env.PROD_WEB} are running in production (web :${env.PROD_WEB_PORT}, api :${env.PROD_API_PORT})."
        }
        failure {
            script {
                try {
                    withCredentials([string(credentialsId: 'crud-kuma-push-token', variable: 'KUMA_TOKEN')]) {
                        powershell '''
                            $msg = [uri]::EscapeDataString("CRUD pipeline FAILED - build $($env:BUILD_NUMBER)")
                            $url = "$($env:KUMA_URL)/api/push/$($env:KUMA_TOKEN)?status=down&msg=$msg&ping="
                            Invoke-RestMethod -Uri $url -TimeoutSec 15 | Out-Null
                        '''
                    }
                } catch (err) {
                    echo "Could not notify Uptime Kuma: ${err}"
                }
            }
        }
    }
}
