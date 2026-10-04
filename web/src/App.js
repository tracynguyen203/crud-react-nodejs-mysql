import React, { useState, useEffect } from "react";
import "./App.css";
import Axios from "axios";
import { API_URL } from "./config";

function App() {
  const [item, setItem] = useState("");
  const [itemU, setItemU] = useState("");
  const [itemList, setItemList] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Axios.get(`${API_URL}/api/get`)
      .then((response) => setItemList(response.data))
      .catch(() => setError("Could not load items"));
  }, []);

  const createItem = () => {
    if (!item.trim()) return;
    Axios.post(`${API_URL}/api/insert`, { item })
      .then((response) => {
        setItemList([...itemList, { id: response.data.insertId, item }]);
        setError("");
      })
      .catch(() => setError("Could not add item"));
  };

  const updateItem = (id) => {
    if (!itemU.trim()) return;
    Axios.put(`${API_URL}/api/update`, { id, itemU })
      .then(() => {
        setItemList(itemList.map((val) => (val.id === id ? { id: val.id, item: itemU } : val)));
        setError("");
      })
      .catch(() => setError("Could not update item"));
    setItemU("");
  };

  const deleteItem = (id) => {
    Axios.delete(`${API_URL}/api/delete/${id}`)
      .then(() => {
        setItemList(itemList.filter((val) => val.id !== id));
        setError("");
      })
      .catch(() => setError("Could not delete item"));
  };

  return (
    <div className="App">
      <div className="four">
        <h1>
          <span>My</span> CRUD <em>App</em>
        </h1>
      </div>
      <div className="form">
        <label htmlFor="item">Item:</label>
        <input id="item" type="text" name="item" onChange={(e) => setItem(e.target.value)} />
        <button className="button-smt" onClick={createItem}>
          Submit
        </button>
        {error && <p role="alert">{error}</p>}
        {itemList.map((val) => (
          <div className="items" key={val.id}>
            <p className="itemsT">{val.item}</p>
            <input
              type="text"
              name="itemU"
              aria-label={`New value for ${val.item}`}
              onChange={(e) => setItemU(e.target.value)}
            />
            <button className="button-upd" onClick={() => updateItem(val.id)}>
              Update
            </button>
            <button className="button-del" onClick={() => deleteItem(val.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
