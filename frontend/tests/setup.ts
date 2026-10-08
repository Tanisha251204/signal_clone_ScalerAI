import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import WS from "ws";

// jsdom's WebSocket mixes Event classes with Node's; use the real `ws` client like a browser would.
(globalThis as unknown as { WebSocket: unknown }).WebSocket = WS;

// jsdom gaps used by the UI
Element.prototype.scrollTo = function () {} as typeof Element.prototype.scrollTo;
Element.prototype.scrollIntoView = function () {};
Element.prototype.animate = (() => ({ cancel() {}, finish() {} })) as unknown as typeof Element.prototype.animate;
window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);

afterEach(() => { cleanup(); localStorage.clear(); });
