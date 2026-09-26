module.exports = {
  onError: async ({ error }) => {
    const payload = {
      at: new Date().toISOString(),
      name: error && error.name,
      message: error && error.message,
      stack: error && error.stack,
      error: String(error),
      cause: error && error.cause ? String(error.cause) : null
    };
    try {
      await fetch("https://wcrpxrcbbigswcqufhik.supabase.co/functions/v1/netlify-debug-capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (captureError) {
      console.error("debug capture failed", captureError);
    }
  }
};
