// js/ui/handlers/TBcall.js

export function initTBcall() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='call']");
    if (!btn) return;

    console.log("Call button clicked");
    // Ici tu mettras ta logique d'appel plus tard
  });
}
