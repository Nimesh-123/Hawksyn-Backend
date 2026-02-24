const validationSchema = {
  "/user/send-otp": {
    schema: {
      email: "required|email",
    },
  },
  "/user/verify-otp": {
    schema: {
      email: "required|email",
      otp: "required|string|size:4",
    },
  },
  "/user/set-pin": {
    schema: {
      email: "required|email",
      mPin: "required|string|size:4",
      confirmMPin: "required|string|size:4",
    },
  },
  "/user/login-with-pin": {
    schema: {
      email: "required|email",
      mPin: "required|string|size:4",
    },
  },
};

module.exports = {
  validationSchema,
};
