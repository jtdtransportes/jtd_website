import { render, waitFor } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = jest.fn();
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 401, headers: { get: () => "application/json" }, json: () => Promise.resolve({ ok: false }) }));
});

test("HashRouter: a página inicial continua sendo renderizada", () => {
  window.location.hash = "#/";
  const { container } = render(<HashRouter><App /></HashRouter>);
  expect(container.querySelector(".header-container")).toBeInTheDocument();
});

test("módulo ANTT sem login redireciona para #/login e não mostra o item ANTT no menu", async () => {
  window.location.hash = "#/antt";
  const { container } = render(<HashRouter><App /></HashRouter>);
  await waitFor(() => expect(window.location.hash).toBe("#/login"));
  const links = [...container.querySelectorAll(".header-list a")].map((a) => a.textContent.trim());
  expect(links).not.toContain("ANTT");
});
