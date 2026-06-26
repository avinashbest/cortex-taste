export function toolResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
    structuredContent: value,
  };
}

export function resourceContents(uri, mimeType, text) {
  return {
    contents: [
      {
        uri,
        mimeType,
        text,
      },
    ],
  };
}

export function prompt(description, text) {
  return {
    description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text,
        },
      },
    ],
  };
}
