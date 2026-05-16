import app from "./src/app";
import request from "supertest";

async function runTest() {
  process.env.NODE_ENV = "test"; // To skip rate limiting
  const signupPayload = {
    username: "testuser_" + Date.now(),
    email: "test_" + Date.now() + "@example.com",
    password: "Password123!"
  };

  console.log("POST /api/auth/signup with payload:", JSON.stringify(signupPayload));
  const signupRes = await request(app)
    .post("/api/auth/signup")
    .send(signupPayload);

  console.log("Signup Status:", signupRes.status);
  console.log("Signup Body:", JSON.stringify(signupRes.body, null, 2));

  if (signupRes.status === 201 || signupRes.status === 200) {
    const userId = signupRes.body.id || signupRes.body.user?.id;
    if (userId) {
      console.log(`GET /api/users/${userId}`);
      const getUserRes = await request(app).get(`/api/users/${userId}`);
      console.log("GetUser Status:", getUserRes.status);
      console.log("GetUser Body:", JSON.stringify(getUserRes.body, null, 2));
    } else {
      console.log("No user id found in signup response.");
    }
  } else {
    console.log("Signup failed, skipping GET /api/users/:id");
  }
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
