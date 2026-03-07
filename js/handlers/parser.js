const parser = {
  parse(text) {
    const parts = text.split(/\s+/);

    return parts.map((p) => {
      if (p.match(/^https?:\/\/.*\.(gif)$/i)) return { type: "gif", value: p };
      if (p.match(/^https?:\/\/.*/)) return { type: "link", value: p };
      return { type: "text", value: p };
    });
  },
};
