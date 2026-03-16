// js/ui/handlers/TBvideo.js

export function initTBvideo() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toolBtn[data-tool='video']");
    if (!btn) return;

    console.log("Video button clicked");
    // Ici tu mettras ta logique de visio plus tard
  });
}
