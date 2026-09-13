import { describe, expect, it } from "vitest";
import { decideAuthRedirect } from "./decide-redirect";

describe("decideAuthRedirect", () => {
  it("redirige a /login cuando no hay sesión y la ruta no es pública", () => {
    const result = decideAuthRedirect({
      hasSession: false,
      belongsToThisApp: false,
      pathname: "/",
    });

    expect(result).toEqual({ action: "redirect", to: "/login" });
  });

  it("deja pasar a /login cuando no hay sesión", () => {
    const result = decideAuthRedirect({
      hasSession: false,
      belongsToThisApp: false,
      pathname: "/login",
    });

    expect(result).toEqual({ action: "allow" });
  });

  it("redirige a /login cuando hay sesión pero es de otra app del mismo Supabase Auth compartido", () => {
    const result = decideAuthRedirect({
      hasSession: true,
      belongsToThisApp: false,
      pathname: "/",
    });

    expect(result).toEqual({ action: "redirect", to: "/login" });
  });

  it("deja pasar cuando hay sesión válida de esta app", () => {
    const result = decideAuthRedirect({
      hasSession: true,
      belongsToThisApp: true,
      pathname: "/",
    });

    expect(result).toEqual({ action: "allow" });
  });

  it("redirige lejos de /login cuando ya hay sesión válida de esta app", () => {
    const result = decideAuthRedirect({
      hasSession: true,
      belongsToThisApp: true,
      pathname: "/login",
    });

    expect(result).toEqual({ action: "redirect", to: "/" });
  });

  it("responde 401 json en vez de redirigir cuando la ruta es de API", () => {
    const result = decideAuthRedirect({
      hasSession: false,
      belongsToThisApp: false,
      pathname: "/api/cuentas",
    });

    expect(result).toEqual({ action: "json-401" });
  });

  it("responde 401 json en una ruta de API si la sesión es de otra app", () => {
    const result = decideAuthRedirect({
      hasSession: true,
      belongsToThisApp: false,
      pathname: "/api/cuentas",
    });

    expect(result).toEqual({ action: "json-401" });
  });

  it("deja pasar una ruta de API cuando la sesión es válida y de esta app", () => {
    const result = decideAuthRedirect({
      hasSession: true,
      belongsToThisApp: true,
      pathname: "/api/cuentas",
    });

    expect(result).toEqual({ action: "allow" });
  });

  it("deja ver /login a una sesión de otra app, en vez de mandarla en loop", () => {
    const result = decideAuthRedirect({
      hasSession: true,
      belongsToThisApp: false,
      pathname: "/login",
    });

    expect(result).toEqual({ action: "allow" });
  });
});
