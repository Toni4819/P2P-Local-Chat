import { FileHandler } from "../../ui/handlers/file.js";
import { GifHandler } from "../../ui/handlers/gif.js";
import { LinkHandler } from "../../ui/handlers/link.js";
import { TextHandler } from "../../ui/handlers/text.js";

export const Renderer = {
  render(parts) {
    return parts
      .map((p) => {
        switch (p.type) {
          case "text":
            return TextHandler.render(p.value);
          case "link":
            return LinkHandler.render(p.value);
          case "gif":
            return GifHandler.render(p.value);
          case "file":
            return FileHandler.renderIncoming(p);
          default:
            return TextHandler.render(p.value);
        }
      })
      .join(" ");
  },
};
