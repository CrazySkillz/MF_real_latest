// Run in the browser console on marketforensics.onrender.com while signed in.
// The object-valued name is invalid: tests prove rejection before all writers.
(async () => {
  if (location.origin !== "https://marketforensics.onrender.com") throw new Error("Open the app's onrender.com page first.");
  const response = await fetch("/api/campaigns/b74f98af-ede9-47af-9b19-0720ebb4d2c0", {
    method: "PATCH", credentials: "same-origin", redirect: "error",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: { batch1AccessCheck: true } }),
  });
  const result = await response.json();
  console.log(JSON.stringify({ status: response.status, message: result.message }));
})();
