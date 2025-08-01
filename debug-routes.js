// Quick debug script to test route conflicts
const express = require('express');
const app = express();

app.get("/api/auth/google/callback", (req, res) => {
  console.log("Route 1 hit");
  res.send("Route 1");
});

app.get("/api/auth/google/callback", (req, res) => {
  console.log("Route 2 hit");
  res.send("Route 2");
});

app.listen(3001, () => {
  console.log('Debug server on 3001');
});