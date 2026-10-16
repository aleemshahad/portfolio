/* =============================================================
   terminal.js — the contact console.
   Everything it prints already exists as a real link elsewhere on
   the page; the terminal is the interactive route to the same
   three channels, never the only one.
   ============================================================= */

import { qs, qsa, esc, reduceMotion } from "./core.js";

const MAX_LINES = 60;

const CHANNELS = {
  whatsapp: {
    label: "whatsapp",
    href: "https://wa.me/923000810352",
    detail: "+92 300 0810352",
    rel: "noopener",
  },
  email: {
    label: "email",
    href: "mailto:aleemssg@gmail.com",
    detail: "aleemssg@gmail.com",
    rel: "",
  },
  github: {
    label: "github",
    href: "https://github.com/aleemshahad",
    detail: "github.com/aleemshahad",
    rel: "noopener",
  },
};

const HELP = [
  ["", "commands:"],
  ["", "  help      show this list"],
  ["", "  whatsapp  open the WhatsApp channel"],
  ["", "  email     open the mail channel"],
  ["", "  github    open the GitHub profile"],
  ["", "  whoami    one-line profile"],
  ["", "  clear     wipe the scrollback"],
];

export function initTerminal() {
  const root = qs("[data-terminal]");
  if (!root) return null;

  const log = qs("[data-cli-log]", root);
  const form = qs("[data-cli-form]", root);
  const input = qs("#cli-input", root);
  const chips = qsa("[data-cmd]", root);
  if (!log || !form || !input) return null;

  const trim = () => {
    while (log.children.length > MAX_LINES) log.removeChild(log.firstElementChild);
  };

  const push = (html, className = "") => {
    const p = document.createElement("p");
    p.className = `cli__line${className ? ` ${className}` : ""}`.trim();
    p.innerHTML = html;
    log.appendChild(p);
    trim();
    log.scrollTop = log.scrollHeight;

    const motionOn = document.documentElement.getAttribute("data-motion") === "on";
    if (motionOn && window.gsap && !reduceMotion()) {
      window.gsap.from(p, { opacity: 0, y: 6, duration: 0.3, ease: "power2.out", overwrite: true });
    }
    return p;
  };

  const run = (raw) => {
    const command = String(raw || "").trim().toLowerCase();
    if (!command) return;

    push(`<span class="c-prompt">$</span> ${esc(command)}`, "cli__line--in");

    if (command === "clear") {
      log.innerHTML = "";
      return;
    }

    if (command === "help" || command === "?" || command === "ls") {
      for (const [, line] of HELP) push(esc(line), "cli__line--dim");
      return;
    }

    if (command === "whoami") {
      push("Aleem Shahzad — Nexus Automation", "cli__line--link");
      push("7+ yrs · python automation · technical seo · full-stack", "cli__line--dim");
      return;
    }

    const key =
      command === "wa" || command === "whatsapp"
        ? "whatsapp"
        : command === "mail" || command === "email"
          ? "email"
          : command === "gh" || command === "github"
            ? "github"
            : null;

    if (key) {
      const ch = CHANNELS[key];
      const target = key === "email" ? "" : ' target="_blank"';
      const rel = ch.rel ? ` rel="${ch.rel}"` : "";
      push(`[ok] ${esc(ch.label)} — ${esc(ch.detail)}`, "cli__line--ok");
      push(
        `<a class="link" href="${esc(ch.href)}"${target}${rel}>open ${esc(ch.label)}</a>`,
        "cli__line--link",
      );
      return;
    }

    push(`command not found: ${esc(command)} — try "help"`, "cli__line--err");
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = "";
    run(value);
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      run(chip.dataset.cmd || "");
      input.focus({ preventScroll: true });
    });
  });

  root.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) return;
    input.focus({ preventScroll: true });
  });

  return { run, destroy() {} };
}
