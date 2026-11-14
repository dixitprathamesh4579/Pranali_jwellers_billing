const crypto = require("crypto");
const secret = () => process.env.DELETE_CAPTCHA_SECRET || process.env.JWT_SECRET;
const sign = (data, key) => crypto.createHmac("sha256", key).update(data).digest("base64url");
const createDeleteCaptcha = (req, res) => {
    const key = secret(); if (!key || key.length < 32) return res.status(500).json({ success: false, message: "Set DELETE_CAPTCHA_SECRET to a random secret of at least 32 characters." });
    const a = crypto.randomInt(1, 10), b = crypto.randomInt(1, 10);
    const payload = Buffer.from(JSON.stringify({ answer: String(a + b), exp: Date.now() + 300000 })).toString("base64url");
    return res.json({ success: true, question: `${a} + ${b} = ?`, token: `${payload}.${sign(payload, key)}`, expiresIn: 300 });
};
const verifyDeleteCaptcha = ({ token, answer }) => {
    const key = secret(); if (!key || key.length < 32 || !token || answer === undefined) return false;
    const p = String(token).split("."); if (p.length !== 2) return false;
    const expected = Buffer.from(sign(p[0], key)), supplied = Buffer.from(p[1]);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return false;
    try { const data = JSON.parse(Buffer.from(p[0], "base64url").toString("utf8")); return Number(data.exp) > Date.now() && String(answer).trim() === String(data.answer); } catch { return false; }
};
module.exports = { createDeleteCaptcha, verifyDeleteCaptcha };
