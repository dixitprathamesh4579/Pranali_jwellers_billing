import { useState } from "react";
import "./Login.css";

const API_URL = "https://pranali-jwellers-billing.onrender.com/api/auth";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function sendOtp(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError(false);

    try {
      const response = await fetch(`${API_URL}/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to send OTP.");
      }

      setOtpSent(true);
      setMessage("OTP sent successfully! Check your email.");
    } catch (err) {
      setError(true);
      setMessage(err.message || "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError(false);

    try {
      const response = await fetch(`${API_URL}/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "OTP verification failed.");
      }

      if (
        data.authenticated !== true ||
        !data.token ||
        !data.user
      ) {
        throw new Error("Authentication could not be completed.");
      }

      // Save JWT token for 24-hour login session
      localStorage.setItem("token", data.token);

      // Save user information
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      // Update React login state
      onLogin(data.user);

    } catch (err) {
      setError(true);
      setMessage(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="shop-logo">✦</div>

        <h1>Jewellery Billing</h1>

        <p className="subtitle">
          Secure access to your jewellery shop
        </p>

        {!otpSent ? (
          <form onSubmit={sendOtp}>
            <label htmlFor="email">Authorized Gmail Address</label>

            <input
              id="email"
              type="email"
              placeholder="Enter your Gmail address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            <p className="email-info">
              Enter the six-digit OTP sent to <strong>{email}</strong>
            </p>

            <label htmlFor="otp">Verification Code</label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              maxLength={6}
              required
            />

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setOtpSent(false);
                setOtp("");
                setMessage("");
                setError(false);
              }}
            >
              Change Email
            </button>
          </form>
        )}

        {message && (
          <p
            className={error ? "error-message" : "success-message"}
            role="status"
          >
            {message}
          </p>
        )}

        <p className="footer-text">Authorized access only</p>
      </div>
    </div>
  );
}