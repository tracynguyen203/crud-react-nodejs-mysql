require("dotenv").config();
const mysql = require("mysql2");
const { createApp } = require("./app");

const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const app = createApp(db, { webHost: process.env.WEB_HOST });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
