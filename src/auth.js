// Guards the mutating routes. Reads (GET) stay public — the interesting
// property to protect is "who can write to the ledger," not "who can read it."
export function requireApiKey(apiKey) {
  return (req, res, next) => {
    if (!apiKey) {
      return res.status(500).json({ error: "server has no API key configured" });
    }
    const header = req.get("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || token !== apiKey) {
      return res.status(401).json({ error: "missing or invalid bearer token" });
    }
    next();
  };
}
