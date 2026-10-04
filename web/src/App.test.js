import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Axios from "axios";
import App from "./App";

jest.mock("axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  Axios.get.mockResolvedValue({ data: [{ id: 1, item: "milk" }] });
});

test("renders heading and loads items from the API", async () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("CRUD");
  expect(await screen.findByText("milk")).toBeInTheDocument();
  expect(Axios.get).toHaveBeenCalledWith(expect.stringContaining("/api/get"));
});

test("creates an item", async () => {
  Axios.post.mockResolvedValue({ data: { insertId: 2 } });
  render(<App />);
  await screen.findByText("milk");
  fireEvent.change(screen.getByLabelText("Item:"), { target: { value: "eggs" } });
  fireEvent.click(screen.getByText("Submit"));
  expect(await screen.findByText("eggs")).toBeInTheDocument();
  expect(Axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/insert"), { item: "eggs" });
});

test("does not submit an empty item", async () => {
  render(<App />);
  await screen.findByText("milk");
  fireEvent.click(screen.getByText("Submit"));
  expect(Axios.post).not.toHaveBeenCalled();
});

test("updates an item", async () => {
  Axios.put.mockResolvedValue({ data: {} });
  render(<App />);
  await screen.findByText("milk");
  fireEvent.change(screen.getByLabelText("New value for milk"), { target: { value: "oat milk" } });
  fireEvent.click(screen.getByText("Update"));
  expect(await screen.findByText("oat milk")).toBeInTheDocument();
  expect(Axios.put).toHaveBeenCalledWith(expect.stringContaining("/api/update"), { id: 1, itemU: "oat milk" });
});

test("deletes an item", async () => {
  Axios.delete.mockResolvedValue({ data: {} });
  render(<App />);
  await screen.findByText("milk");
  fireEvent.click(screen.getByText("Delete"));
  await waitFor(() => expect(screen.queryByText("milk")).not.toBeInTheDocument());
  expect(Axios.delete).toHaveBeenCalledWith(expect.stringContaining("/api/delete/1"));
});

test("shows an error when loading fails", async () => {
  Axios.get.mockRejectedValue(new Error("network"));
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load items");
});
