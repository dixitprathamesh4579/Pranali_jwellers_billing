require("dotenv").config();

async function sendOtpEmail(email, otp) {
const response = await fetch("https://api.resend.com/emails", {
method: "POST",
headers: {
"Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
from: process.env.MAIL_FROM,
to: [email],
subject: "Your PRANALI JEWELLERS Login OTP",
text: `Your login OTP is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`,
html: `                 <div style="font-family: Arial, sans-serif; padding: 20px;">                     <h2>PRANALI JEWELLERS</h2>                     <p>Use the following OTP to access your account:</p>                     <h1 style="letter-spacing: 8px;">${otp}</h1>                     <p>This OTP expires in 5 minutes.</p>                     <p>If you did not request this code, ignore this email.</p>                 </div>
            `
})
});

```
const result = await response.json();

if (!response.ok) {
    console.error("Resend email error:", result);
    throw new Error(result.message || "Failed to send OTP email");
}

return result;
```

}

module.exports = { sendOtpEmail };
