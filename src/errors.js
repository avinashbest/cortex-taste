export function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function jsonRpcError(code, message) {
  return { code, message };
}

export function toRpcError(error) {
  return {
    code: Number.isInteger(error.code) ? error.code : -32603,
    message: error.message || "Internal error",
  };
}
