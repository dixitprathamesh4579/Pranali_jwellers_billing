import { useEffect, useState } from "react";
import "./SHCustomers.css";

const API_URL =
    `${import.meta.env.VITE_API_BASE_URL || "https://pranali-jwellers-billing.onrender.com"}/api/sh-bills`;

const money = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

const formatDate = (date) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

export default function SHCustomers() {
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerBills, setCustomerBills] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [selectedPaymentBill, setSelectedPaymentBill] = useState(null);

    const [paymentForm, setPaymentForm] = useState({
        payment_amount: "",
        payment_date: new Date().toISOString().split("T")[0],
        payment_mode: "CASH",
        remarks: ""
    });

    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentMessage, setPaymentMessage] = useState("");

    const [historyBillId, setHistoryBillId] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
    const [detailBill, setDetailBill] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [paymentSuccessBill, setPaymentSuccessBill] = useState(null);

    // ---------------- FETCH CUSTOMERS ----------------

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                search: search.trim(),
                filter,
            });

            const response = await fetch(
                `${API_URL}/customers?${params.toString()}`
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to fetch customers."
                );
            }

            setCustomers(result.customers || []);

        } catch (err) {
            console.error("Fetch Customers Error:", err);
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    // Fetch when search or filter changes
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCustomers();
        }, 300);

        return () => clearTimeout(timer);
    }, [search, filter]);

    // ---------------- CUSTOMER SUMMARY ----------------

    const totalCustomers = customers.length;

    const pendingCustomers = customers.filter(
        (customer) => Number(customer.total_due) > 0
    ).length;

    const totalPurchase = customers.reduce(
        (sum, customer) =>
            sum + Number(customer.total_purchase || 0),
        0
    );

    const totalDue = customers.reduce(
        (sum, customer) =>
            sum + Number(customer.total_due || 0),
        0
    );

    // ---------------- CUSTOMER BILL HISTORY ----------------

    const viewCustomer = async (customer) => {
        try {
            setSelectedCustomer(customer);
            setCustomerBills([]);
            setHistoryLoading(true);

            const response = await fetch(
                `${API_URL}/customers/${encodeURIComponent(
                    customer.customer_phone
                )}/bills`
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to fetch bill history."
                );
            }

            setCustomerBills(result.bills || []);

        } catch (err) {
            console.error("Customer History Error:", err);
            setError(err.message);
        } finally {
            setHistoryLoading(false);
        }
    };
    // REFRESH CUSTOMER DETAILS
    const refreshCustomerDetails = async () => {
        if (!selectedCustomer) return;

        await fetchCustomers();

        const response = await fetch(
            `${API_URL}/customers/${encodeURIComponent(
                selectedCustomer.customer_phone
            )}/bills`
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to refresh bill history.");
        }

        const updatedBills = result.bills || [];
        setCustomerBills(updatedBills);

        // Recalculate customer totals from updated bills.
        const updatedCustomer = {
            ...selectedCustomer,
            total_purchase: updatedBills.reduce(
                (sum, bill) => sum + Number(bill.grand_total || 0), 0
            ),
            total_paid: updatedBills.reduce(
                (sum, bill) => sum + Number(bill.paid_amount || 0), 0
            ),
            total_due: updatedBills.reduce(
                (sum, bill) => sum + Number(bill.due_amount || 0), 0
            )
        };

        setSelectedCustomer(updatedCustomer);
    };


    // OPEN PAYMENT FORM
    const openPaymentForm = (bill) => {
        setSelectedPaymentBill(bill);

        setPaymentForm({
            payment_amount: "",
            payment_date: new Date().toISOString().split("T")[0],
            payment_mode: "CASH",
            remarks: ""
        });

        setPaymentMessage("");
    };


    // RECORD PAYMENT
    const handleRecordPayment = async (e) => {
        e.preventDefault();

        if (!selectedPaymentBill) return;

        const amount = Number(paymentForm.payment_amount);
        const due = Number(selectedPaymentBill.due_amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            setPaymentMessage("Enter a valid payment amount.");
            return;
        }

        if (amount > due + 0.001) {
            setPaymentMessage(
                `Payment cannot exceed pending due of ${money(due)}.`
            );
            return;
        }

        try {
            setPaymentLoading(true);
            setPaymentMessage("");

            const response = await fetch(
                `${API_URL}/${selectedPaymentBill.id}/payments`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(paymentForm)
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Unable to record payment.");
            }

            setPaymentSuccessBill({ ...selectedPaymentBill, paid_amount: Number(selectedPaymentBill.paid_amount || 0) + amount, due_amount: Math.max(0, due - amount) });
            setPaymentMessage("Payment recorded successfully!");

            setSelectedPaymentBill(null);

            await refreshCustomerDetails();

        } catch (err) {
            setPaymentMessage(err.message || "Payment failed.");
        } finally {
            setPaymentLoading(false);
        }
    };


    // VIEW COMPLETE BILL DETAILS
    const viewBillDetails = async (bill) => {
        try {
            setDetailLoading(true);
            setDetailBill(null);
            const response = await fetch(`${API_URL}/${bill.id}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Unable to fetch bill details.");
            const parsed = (value, fallback = []) => {
                if (Array.isArray(value)) return value;
                if (typeof value === "string") { try { return JSON.parse(value); } catch { return fallback; } }
                return fallback;
            };
            setDetailBill({ ...result.bill, items: parsed(result.bill.items), exchange_items: parsed(result.bill.exchange_items) });
        } catch (err) {
            setError(err.message || "Unable to fetch bill details.");
        } finally { setDetailLoading(false); }
    };

    // PRINT BILL AS PDF (A4 Pranali Jewellers sales-bill layout)
    const printBill = async (bill) => {
        try {
            // Always load the latest bill and payment records before printing.
            const [billResponse, paymentsResponse] = await Promise.all([
                fetch(`${API_URL}/${bill.id}`),
                fetch(`${API_URL}/${bill.id}/payments`)
            ]);

            const billResult = await billResponse.json();
            const paymentsResult = await paymentsResponse.json();

            if (!billResponse.ok) {
                throw new Error(billResult.message || "Unable to fetch bill for printing.");
            }
            if (!paymentsResponse.ok) {
                throw new Error(paymentsResult.message || "Unable to fetch updated payment details.");
            }

            const b = billResult.bill || bill;
            const payments = Array.isArray(paymentsResult.payments) ? paymentsResult.payments : [];
            const parseItems = (value) => {
                if (Array.isArray(value)) return value;
                if (typeof value === "string") {
                    try {
                        const parsed = JSON.parse(value);
                        return Array.isArray(parsed) ? parsed : [];
                    } catch { return []; }
                }
                return [];
            };
            const items = parseItems(b.items);
            const exchanges = parseItems(b.exchange_items);
            const safe = (value) => String(value ?? "-").replace(/[&<>"']/g, (ch) => ({
                "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
            }[ch]));
            const pick = (obj, keys, fallback = "-") => {
                for (const key of keys) {
                    if (obj?.[key] !== undefined && obj?.[key] !== null && obj[key] !== "") return obj[key];
                }
                return fallback;
            };
            const num = (value) => Number(value) || 0;
            const rupees = (value) => `Rs. ${num(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const dateText = (value) => value ? formatDate(value) : "-";

            // Payment endpoint is the source for the individual transactions;
            // the saved bill totals remain authoritative for the current balance.
            const paidAmount = b.paid_amount ?? payments.reduce((sum, p) => sum + num(p.payment_amount), 0);
            const dueAmount = b.due_amount ?? Math.max(0, num(b.net_payable ?? b.grand_total) - num(paidAmount));
            const paymentStatus = num(dueAmount) <= 0 ? "FULLY PAID" : num(paidAmount) > 0 ? "PARTIALLY PAID" : "PAYMENT PENDING";

            const amountInWords = (amount) => {
                const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
                const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
                const underThousand = (n) => {
                    let out = "";
                    if (n >= 100) { out += `${ones[Math.floor(n / 100)]} Hundred `; n %= 100; }
                    if (n >= 20) { out += `${tens[Math.floor(n / 10)]} `; n %= 10; }
                    if (n > 0) out += `${ones[n]} `;
                    return out.trim();
                };
                let n = Math.max(0, Math.round(num(amount)));
                if (!n) return "Zero Rupees Only";
                const parts = [];
                const crore = Math.floor(n / 10000000); n %= 10000000;
                const lakh = Math.floor(n / 100000); n %= 100000;
                const thousand = Math.floor(n / 1000); n %= 1000;
                if (crore) parts.push(`${underThousand(crore)} Crore`);
                if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
                if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
                if (n) parts.push(underThousand(n));
                return `${parts.join(" ")} Rupees Only`;
            };

            const itemRows = (list, exchange = false) => list.length
                ? list.map((item, index) => {
                    const metal = pick(item, ["metal", "metal_type", "material"], "-");
                    const purity = pick(item, ["purity", "metal_purity"], "");
                    const metalPurity = purity ? `${metal} / ${purity}` : metal;
                    const weight = pick(item, ["weight", "net_weight", "gross_weight"], "-");
                    const rate = pick(item, ["rate", "rate_per_gram", "price"], 0);
                    const metalAmount = pick(item, ["metal_amount", "gold_amount", "metal_value"], pick(item, ["amount", "total", "value"], 0));
                    const making = pick(item, ["making_amount", "making_charges", "making"], 0);
                    const total = pick(item, ["total", "total_amount", "amount", "value"], num(metalAmount) + num(making));
                    return `<tr>
                        <td class="center">${index + 1}</td>
                        <td>${safe(pick(item, ["name", "item_name", "description", "product"], exchange ? "Exchange Jewellery" : "Jewellery Item"))}</td>
                        <td>${safe(metalPurity)}</td>
                        <td class="right">${safe(weight)}</td>
                        <td class="right">${safe(num(rate).toFixed(2))}</td>
                        <td class="right">${safe(rupees(metalAmount))}</td>
                        <td class="right">${safe(rupees(making))}</td>
                        <td class="right">${safe(rupees(total))}</td>
                    </tr>`;
                }).join("")
                : `<tr><td colspan="8" class="empty">No ${exchange ? "exchange " : ""}jewellery items recorded.</td></tr>`;

            const paymentRows = payments.length
                ? payments.map((payment, index) => `<tr>
                    <td class="center">${index + 1}</td>
                    <td>${safe(dateText(payment.payment_date))}</td>
                    <td>${safe(String(payment.payment_mode || "-").replaceAll("_", " "))}</td>
                    <td>${safe(payment.remarks || "-")}</td>
                    <td class="right">${safe(rupees(payment.payment_amount))}</td>
                </tr>`).join("")
                : `<tr><td colspan="5" class="empty">No payment transactions recorded.</td></tr>`;

            const subtotal = b.subtotal ?? b.grand_total ?? 0;
            const discount = b.discount_amount ?? b.discount ?? 0;
            const grandTotal = b.grand_total ?? b.net_payable ?? 0;
            const billDate = dateText(b.bill_date || b.created_at);
            const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Pranali Jewellers - ${safe(b.bill_number)}</title>
<style>
@page{size:A4 portrait;margin:9mm}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#3f3325;font-family:Georgia,"Times New Roman",serif;font-size:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.invoice{min-height:277mm;border:2px solid #9b742e;padding:5px}
.inner{min-height:265mm;border:1px solid #c7a65d;padding:10px;display:flex;flex-direction:column}
.header{text-align:center;background:#f7f1e4;padding:8px 6px 10px;border-bottom:1px solid #d7c49b}
.brand{font-size:23px;font-weight:bold;letter-spacing:1px;color:#80551b;margin:0 0 3px}
.tagline{font-size:9px;letter-spacing:.5px;margin:0 0 4px}
.owner,.address,.contact{font-size:8px;margin:2px 0;color:#55452f}
.title{font-size:17px;font-weight:bold;color:#80551b;margin:8px 0 0}
.info{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin:12px 0 8px}
.info-box{border:1px solid #d8c9a8;border-radius:5px;overflow:hidden;min-height:85px}
.box-title{background:#f2e8d0;color:#5d4829;font-weight:bold;padding:6px 9px;font-size:9px}
.info-body{padding:8px 10px;line-height:2;font-size:9px}
.info-body strong{font-weight:bold}
.section-title{font-size:11px;font-weight:bold;color:#80551b;margin:8px 0 5px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{background:#80551b;color:#fff;padding:6px 4px;border:1px solid #b69a68;font-size:8px}
td{padding:6px 4px;border:1px solid #cfc3aa;font-size:8px;overflow-wrap:anywhere}
.center{text-align:center}.right{text-align:right;white-space:nowrap}
.empty{text-align:center;color:#76664e;padding:10px}
.summary{margin:10px 0 0 auto;width:100%;max-width:100%}
.summary-row{display:flex;justify-content:space-between;padding:5px 8px;border-bottom:1px solid #e7dfd0;font-size:9px}
.summary-row strong{font-weight:normal}
.summary-row.total{background:#80551b;color:white;font-weight:bold;border-radius:3px}
.summary-row.total strong{font-weight:bold}
.words{border:1px solid #d8c9a8;background:#f8f3e8;border-radius:5px;padding:9px 10px;margin-top:14px;min-height:55px}
.words-title{font-size:9px;font-weight:bold;color:#80551b;margin-bottom:8px}
.words-text{font-size:9px}
.payments{margin-top:12px}
.status{font-size:8px;font-weight:bold;color:#80551b;text-align:right;margin-top:5px}
.bottom{margin-top:auto;padding-top:16px}
.terms{border-top:1px solid #b99b62;padding-top:8px;font-size:8px;line-height:1.5}
.terms-title{font-weight:bold;color:#80551b;margin-bottom:4px}
.signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin-top:22px;text-align:center;font-size:8px}
.sign-line{border-top:1px solid #777;padding-top:5px;margin-top:17px}
.sign-brand{font-weight:bold;margin-top:5px}
.footer{background:#80551b;color:#f8edcf;text-align:center;padding:5px;margin-top:12px;font-style:italic;font-size:9px}
@media print{.invoice{break-inside:avoid}tr{break-inside:avoid}}
</style></head><body><div class="invoice"><div class="inner">
<header class="header">
<div class="brand">PRANALI JEWELLERS</div>
<p class="tagline">GOLD | SILVER | ONE GRAM | CUSTOM JEWELLERY</p>
<p class="owner">BY - Prakash Dixit(sir)</p>
<p class="address">Grampanchayat Gala No.04, Main Road - mandai, Dighanchi, Maharashtra - 415315</p>
<p class="contact">Phone: +91 9421124579 | Email: pranalijewellers@gmail.com</p>
<div class="title">SALES INVOICE</div>
</header>
<div class="info">
<section class="info-box"><div class="box-title">CUSTOMER DETAILS</div><div class="info-body">
<div>Name: <strong>${safe(b.customer_name)}</strong></div>
<div>Mobile: <strong>${safe(b.customer_phone)}</strong></div>
<div>Address: <strong>${safe(b.customer_address || "-")}</strong></div>
</div></section>
<section class="info-box"><div class="box-title">INVOICE DETAILS</div><div class="info-body">
<div>Bill No: <strong>${safe(b.bill_number)}</strong></div>
<div>Date: <strong>${safe(billDate)}</strong></div>
<div>Status: <strong>${safe(paymentStatus)}</strong></div>
</div></section>
</div>
<div class="section-title">NEW GOLD / SILVER / OTHER DETAILS</div>
<table><thead><tr>
<th style="width:4%">Sr.</th><th style="width:20%">Jewellery Description</th><th style="width:14%">Metal / Purity</th><th style="width:9%">Wt. (g)</th><th style="width:10%">Rate per g</th><th style="width:13%">Metal</th><th style="width:12%">Making</th><th style="width:18%">Total</th>
</tr></thead><tbody>${itemRows(items)}</tbody></table>
${exchanges.length ? `<div class="section-title">EXCHANGE JEWELLERY DETAILS</div><table><thead><tr><th style="width:4%">Sr.</th><th style="width:20%">Jewellery Description</th><th style="width:14%">Metal / Purity</th><th style="width:9%">Wt. (g)</th><th style="width:10%">Rate per g</th><th style="width:13%">Metal</th><th style="width:12%">Making</th><th style="width:18%">Total</th></tr></thead><tbody>${itemRows(exchanges,true)}</tbody></table>` : ""}
<div class="summary">
<div class="summary-row"><span>Subtotal</span><strong>${safe(rupees(subtotal))}</strong></div>
<div class="summary-row"><span>Discount</span><strong>${safe(rupees(discount))}</strong></div>
${num(b.gst_amount) ? `<div class="summary-row"><span>GST</span><strong>${safe(rupees(b.gst_amount))}</strong></div>` : ""}
${num(b.exchange_total) ? `<div class="summary-row"><span>Exchange Value</span><strong>${safe(rupees(b.exchange_total))}</strong></div>` : ""}
<div class="summary-row total"><span>GRAND TOTAL</span><strong>${safe(rupees(grandTotal))}</strong></div>
<div class="summary-row"><span>PAID AMOUNT</span><strong>${safe(rupees(paidAmount))}</strong></div>
<div class="summary-row"><span>DUE AMOUNT</span><strong>${safe(rupees(dueAmount))}</strong></div>
</div>
<div class="words"><div class="words-title">TOTAL AMOUNT IN WORDS</div><div class="words-text">${safe(amountInWords(b.net_payable ?? grandTotal))}</div></div>
${payments.length ? `<section class="payments"><div class="section-title">PAYMENT DETAILS / UPDATED PAYMENT HISTORY</div><table><thead><tr><th style="width:8%">Sr.</th><th style="width:19%">Payment Date</th><th style="width:20%">Payment Mode</th><th>Remarks</th><th style="width:22%">Amount</th></tr></thead><tbody>${paymentRows}</tbody></table><div class="status">TOTAL PAYMENTS RECEIVED: ${safe(rupees(paidAmount))} &nbsp; | &nbsp; BALANCE DUE: ${safe(rupees(dueAmount))}</div></section>` : ""}
<div class="bottom">
<div class="terms"><div class="terms-title">TERMS &amp; CONDITIONS</div>
<div>1. Goods once sold will not be taken back or exchanged.</div>
<div>2. Purity as per applicable hallmark details.</div>
<div>3. Thank you for shopping with us.</div>
<div class="signatures"><div><div class="sign-line">Customer Signature</div></div><div><div class="sign-line">Authorised Signatory</div><div class="sign-brand">PRANALI JEWELLERS</div></div></div>
</div>
<div class="footer">Your Trust &nbsp; • &nbsp; Our Heritage &nbsp; • &nbsp; Timeless Jewellery</div>
</div></div></div>
<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),400));window.addEventListener("afterprint",()=>window.close());</script>
</body></html>`;

            const win = window.open("", "_blank");
            if (!win) {
                setError("Please allow pop-ups to print this bill.");
                return;
            }
            win.document.open();
            win.document.write(html);
            win.document.close();
        } catch (err) {
            console.error("Print Bill Error:", err);
            setError(err.message || "Printing failed.");
        }
    };

    // VIEW PAYMENT HISTORY
    const viewPaymentHistory = async (bill) => {
        try {
            setHistoryBillId(bill.id);
            setPaymentHistory([]);
            setPaymentHistoryLoading(true);

            const response = await fetch(
                `${API_URL}/${bill.id}/payments`
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Unable to fetch payment history.");
            }

            setPaymentHistory(result.payments || []);

        } catch (err) {
            setPaymentMessage(err.message);
        } finally {
            setPaymentHistoryLoading(false);
        }
    };

    // ---------------- CLOSE CUSTOMER DETAILS ----------------

    const closeCustomer = () => {
        setSelectedCustomer(null);
        setCustomerBills([]);
    };

    // ---------------- UI ----------------

    return (
        <main className="shcustomers-page">

            {/* PAGE HEADER */}

            <div className="shcustomers-header">
                <div>
                    <h1>SH Customers</h1>
                    <p>
                        Manage your jewellery customers and their
                        billing records.
                    </p>
                </div>

                <button
                    className="shcustomers-refresh"
                    onClick={fetchCustomers}
                    type="button"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* SUMMARY CARDS */}

            <section className="shcustomers-stats">

                <div className="shcustomer-stat-card">
                    <div className="shcustomer-stat-icon">♙</div>
                    <div>
                        <p>Total Customers</p>
                        <h2>{totalCustomers}</h2>
                    </div>
                </div>

                <div className="shcustomer-stat-card">
                    <div className="shcustomer-stat-icon">₹</div>
                    <div>
                        <p>Total Purchase</p>
                        <h2>{money(totalPurchase)}</h2>
                    </div>
                </div>

                <div className="shcustomer-stat-card">
                    <div className="shcustomer-stat-icon">!</div>
                    <div>
                        <p>Customers With Dues</p>
                        <h2>{pendingCustomers}</h2>
                    </div>
                </div>

                <div className="shcustomer-stat-card">
                    <div className="shcustomer-stat-icon">◷</div>
                    <div>
                        <p>Total Pending Amount</p>
                        <h2>{money(totalDue)}</h2>
                    </div>
                </div>

            </section>

            {/* CUSTOMER LIST */}

            <section className="shcustomers-card">

                <div className="shcustomers-list-heading">
                    <div>
                        <h2>Customer Directory</h2>
                        <p>All customers created through SH Bills.</p>
                    </div>
                </div>

                {/* SEARCH */}

                <div className="shcustomers-controls">

                    <div className="shcustomers-search">
                        <span>⌕</span>

                        <input
                            type="text"
                            placeholder="Search by bill number, name or mobile..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <div className="shcustomers-filters">

                        <button
                            type="button"
                            className={filter === "all" ? "active" : ""}
                            onClick={() => setFilter("all")}
                        >
                            All Customers
                        </button>

                        <button
                            type="button"
                            className={filter === "pending" ? "active" : ""}
                            onClick={() => setFilter("pending")}
                        >
                            Pending Dues
                        </button>

                        <button
                            type="button"
                            className={filter === "paid" ? "active" : ""}
                            onClick={() => setFilter("paid")}
                        >
                            Fully Paid
                        </button>

                    </div>

                </div>

                {/* ERROR */}

                {error && (
                    <div className="shcustomers-error">
                        {error}
                    </div>
                )}

                {/* TABLE */}

                <div className="shcustomers-table-wrapper">

                    <table className="shcustomers-table">

                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Mobile Number</th>
                                <th>Total Bills</th>
                                <th>Total Purchase</th>
                                <th>Paid Amount</th>
                                <th>Pending Due</th>
                                <th>Last Bill</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>

                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="shcustomers-empty">
                                        Loading customers...
                                    </td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="shcustomers-empty">
                                        No customers found.
                                    </td>
                                </tr>
                            ) : (
                                customers.map((customer, index) => (

                                    <tr key={customer.customer_phone || index}>

                                        <td>
                                            <div className="shcustomer-name">
                                                <div className="shcustomer-avatar">
                                                    {customer.customer_name
                                                        ?.charAt(0)
                                                        .toUpperCase()}
                                                </div>

                                                <strong>
                                                    {customer.customer_name}
                                                </strong>
                                            </div>
                                        </td>

                                        <td>{customer.customer_phone}</td>

                                        <td>
                                            {customer.total_bills}
                                        </td>

                                        <td>
                                            {money(customer.total_purchase)}
                                        </td>

                                        <td>
                                            {money(customer.total_paid)}
                                        </td>

                                        <td>
                                            <span
                                                className={
                                                    Number(customer.total_due) > 0
                                                        ? "shcustomer-due"
                                                        : "shcustomer-paid"
                                                }
                                            >
                                                {money(customer.total_due)}
                                            </span>
                                        </td>

                                        <td>
                                            {formatDate(customer.last_bill_date)}
                                        </td>

                                        <td>
                                            <button
                                                className="shcustomer-view-button"
                                                type="button"
                                                onClick={() => viewCustomer(customer)}
                                            >
                                                View Details
                                            </button>
                                        </td>

                                    </tr>

                                ))
                            )}

                        </tbody>

                    </table>

                </div>

                <div className="shcustomers-table-footer">
                    Showing {customers.length} customers
                </div>

            </section>

            {/* CUSTOMER DETAILS MODAL */}

            {selectedCustomer && (

                <div
                    className="shcustomer-modal-overlay"
                    onClick={closeCustomer}
                >

                    <section
                        className="shcustomer-modal"
                        onClick={(e) => e.stopPropagation()}
                    >

                        <div className="shcustomer-modal-header">

                            <div>
                                <h2>Customer Details</h2>
                                <p>Customer billing information and history.</p>
                            </div>

                            <button
                                type="button"
                                onClick={closeCustomer}
                            >
                                ×
                            </button>

                        </div>

                        <div className="shcustomer-profile">

                            <div className="shcustomer-profile-avatar">
                                {selectedCustomer.customer_name
                                    ?.charAt(0)
                                    .toUpperCase()}
                            </div>

                            <div>
                                <h3>{selectedCustomer.customer_name}</h3>
                                <p>{selectedCustomer.customer_phone}</p>
                                <p>
                                    {selectedCustomer.customer_address || "No address available"}
                                </p>
                            </div>

                        </div>

                        <div className="shcustomer-history-stats">

                            <div>
                                <span>Total Purchase</span>
                                <strong>
                                    {money(selectedCustomer.total_purchase)}
                                </strong>
                            </div>

                            <div>
                                <span>Total Paid</span>
                                <strong>
                                    {money(selectedCustomer.total_paid)}
                                </strong>
                            </div>

                            <div>
                                <span>Pending Due</span>
                                <strong className="shcustomer-due">
                                    {money(selectedCustomer.total_due)}
                                </strong>
                            </div>

                        </div>
                        <h3 className="shcustomer-history-title">
                            Bill History
                        </h3>

                        {historyLoading ? (
                            <p className="shcustomers-empty">Loading bill history...</p>
                        ) : customerBills.length === 0 ? (
                            <p className="shcustomers-empty">No bill history found.</p>
                        ) : (
                            <div className="shcustomer-history-table-wrapper">
                                <table className="shcustomers-table">
                                    <thead>
                                        <tr>
                                            <th>Bill Number</th>
                                            <th>Date</th>
                                            <th>Billing Type</th>
                                            <th>Grand Total</th>
                                            <th>Paid</th>
                                            <th>Due</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {customerBills.map((bill) => (
                                            <tr key={bill.id}>
                                                <td>{bill.bill_number}</td>
                                                <td>{formatDate(bill.bill_date)}</td>
                                                <td>{bill.billing_type}</td>
                                                <td>{money(bill.grand_total)}</td>
                                                <td className="shcustomer-paid">
                                                    {money(bill.paid_amount)}
                                                </td>
                                                <td>
                                                    <span
                                                        className={
                                                            Number(bill.due_amount) > 0
                                                                ? "shcustomer-due"
                                                                : "shcustomer-paid"
                                                        }
                                                    >
                                                        {money(bill.due_amount)}
                                                    </span>
                                                </td>

                                                <td>
                                                    <div className="shcustomer-actions">
                                                        <button type="button" className="shcustomer-history-button" onClick={() => viewBillDetails(bill)}>View Bill</button>
                                                        <button type="button" className="shcustomer-history-button" onClick={() => printBill(bill)}>Print / PDF</button>
                                                        {Number(bill.due_amount) > 0 && (
                                                            <button
                                                                type="button"
                                                                className="shcustomer-payment-button"
                                                                onClick={() => openPaymentForm(bill)}
                                                            >
                                                                + Payment
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            className="shcustomer-history-button"
                                                            onClick={() => viewPaymentHistory(bill)}
                                                        >
                                                            History
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
            {/* COMPLETE BILL DETAILS MODAL */}
            {detailLoading && <div className="shcustomer-modal-overlay"><section className="shcustomer-payment-modal"><p>Loading bill details...</p></section></div>}
            {detailBill && (
                <div className="shcustomer-modal-overlay" onClick={() => setDetailBill(null)}>
                    <section className="shcustomer-payment-modal shcustomer-bill-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="shcustomer-modal-header"><div><h2>Bill Details · {detailBill.bill_number}</h2><p>Complete saved bill information</p></div><button type="button" onClick={() => setDetailBill(null)}>×</button></div>
                        <div className="shcustomer-bill-detail-content">
                            <h3>Customer & Bill</h3><div className="shcustomer-bill-detail-grid">
                                <div><span>Customer</span><strong>{detailBill.customer_name}</strong></div><div><span>Mobile</span><strong>{detailBill.customer_phone}</strong></div><div><span>Date</span><strong>{formatDate(detailBill.bill_date)}</strong></div><div><span>Billing Type</span><strong>{detailBill.billing_type}</strong></div><div className="wide"><span>Address</span><strong>{detailBill.customer_address || '-'}</strong></div>
                            </div>
                            <h3>Items</h3>{detailBill.items?.length ? <div className="shcustomer-history-table-wrapper"><table className="shcustomers-table"><thead><tr><th>#</th><th>Item Details</th><th>Weight</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{detailBill.items.map((it,i)=><tr key={i}><td>{i+1}</td><td>{it.name || it.item_name || it.description || it.product || Object.entries(it).filter(([k])=>!['amount','total'].includes(k)).map(([k,v])=>`${k}: ${v}`).join(' · ')}</td><td>{it.weight ?? it.net_weight ?? it.gross_weight ?? '-'}</td><td>{it.quantity ?? it.qty ?? 1}</td><td>{money(it.rate ?? it.price ?? 0)}</td><td>{money(detailBill.grand_total)}</td></tr>)}</tbody></table></div>:<p>No item details saved.</p>}
                            {detailBill.exchange_items?.length>0 && <><h3>Exchange Items</h3><div className="shcustomer-history-table-wrapper"><table className="shcustomers-table"><thead><tr><th>#</th><th>Details</th><th>Weight</th><th>Quantity</th><th>Value</th></tr></thead><tbody>{detailBill.exchange_items.map((it,i)=><tr key={i}><td>{i+1}</td><td>{it.name || it.item_name || it.description || Object.entries(it).map(([k,v])=>`${k}: ${v}`).join(' · ')}</td><td>{it.weight ?? it.net_weight ?? it.gross_weight ?? '-'}</td><td>{it.quantity ?? it.qty ?? 1}</td><td>{money(it.amount ?? it.total ?? it.value ?? 0)}</td></tr>)}</tbody></table></div></>}
                            <h3>Bill Summary</h3><div className="shcustomer-bill-detail-grid financial"><div><span>Subtotal</span><strong>{money(detailBill.subtotal)}</strong></div><div><span>Discount</span><strong>{money(detailBill.discount_amount)}</strong></div><div><span>GST</span><strong>{money(detailBill.gst_amount)}</strong></div><div><span>Grand Total</span><strong>{money(detailBill.grand_total)}</strong></div><div><span>Exchange Value</span><strong>{money(detailBill.exchange_total)}</strong></div><div><span>Net Payable</span><strong>{money(detailBill.net_payable)}</strong></div><div><span>Paid</span><strong className="shcustomer-paid">{money(detailBill.paid_amount)}</strong></div><div><span>Due</span><strong className="shcustomer-due">{money(detailBill.due_amount)}</strong></div></div>
                        </div><div className="shcustomer-payment-actions"><button type="button" className="shcustomer-cancel-button" onClick={()=>setDetailBill(null)}>Close</button><button type="button" className="shcustomer-submit-payment" onClick={()=>printBill(detailBill)}>Print / Save PDF</button></div>
                    </section>
                </div>
            )}

            {/* RECORD PAYMENT MODAL */}

            {selectedPaymentBill && (
                <div className="shcustomer-modal-overlay">
                    <section
                        className="shcustomer-payment-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="shcustomer-modal-header">
                            <div>
                                <h2>Record Payment</h2>
                                <p>Bill: {selectedPaymentBill.bill_number}</p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSelectedPaymentBill(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="shcustomer-payment-summary">
                            <div>
                                <span>Bill Amount</span>
                                <strong>{money(selectedPaymentBill.grand_total)}</strong>
                            </div>

                            <div>
                                <span>Already Paid</span>
                                <strong>{money(selectedPaymentBill.paid_amount)}</strong>
                            </div>

                            <div>
                                <span>Pending Due</span>
                                <strong className="shcustomer-due">
                                    {money(selectedPaymentBill.due_amount)}
                                </strong>
                            </div>
                        </div>

                        <form onSubmit={handleRecordPayment}>
                            <label>Payment Amount (₹)</label>
                            <input
                                type="number"
                                min="0.01"
                                max={Number(selectedPaymentBill.due_amount)}
                                step="0.01"
                                required
                                value={paymentForm.payment_amount}
                                onChange={(e) =>
                                    setPaymentForm({
                                        ...paymentForm,
                                        payment_amount: e.target.value
                                    })
                                }
                                placeholder="Enter amount"
                            />

                            <label>Payment Date</label>
                            <input
                                type="date"
                                required
                                value={paymentForm.payment_date}
                                onChange={(e) =>
                                    setPaymentForm({
                                        ...paymentForm,
                                        payment_date: e.target.value
                                    })
                                }
                            />

                            <label>Payment Mode</label>
                            <select
                                value={paymentForm.payment_mode}
                                onChange={(e) =>
                                    setPaymentForm({
                                        ...paymentForm,
                                        payment_mode: e.target.value
                                    })
                                }
                            >
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                <option value="CARD">Card</option>
                                <option value="OTHER">Other</option>
                            </select>

                            <label>Remarks (Optional)</label>
                            <textarea
                                value={paymentForm.remarks}
                                onChange={(e) =>
                                    setPaymentForm({
                                        ...paymentForm,
                                        remarks: e.target.value
                                    })
                                }
                                placeholder="Enter payment remarks"
                                rows="3"
                            />

                            {paymentMessage && (
                                <div className="shcustomers-error">
                                    {paymentMessage}
                                </div>
                            )}

                            <div className="shcustomer-payment-actions">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPaymentBill(null)}
                                    className="shcustomer-cancel-button"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={paymentLoading}
                                    className="shcustomer-submit-payment"
                                >
                                    {paymentLoading ? "Saving..." : "Save Payment"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {/* PAYMENT SAVED CONFIRMATION */}
            {paymentSuccessBill && (
                <div className="shcustomer-modal-overlay" onClick={() => setPaymentSuccessBill(null)}>
                    <section className="shcustomer-payment-modal" onClick={e => e.stopPropagation()}>
                        <div className="shcustomer-modal-header"><div><h2>✓ Payment Saved</h2><p>{paymentSuccessBill.bill_number}</p></div><button type="button" onClick={() => setPaymentSuccessBill(null)}>×</button></div>
                        <p className="shcustomer-payment-success-text">Payment recorded successfully. You can now print or save this bill as a PDF.</p>
                        <div className="shcustomer-payment-actions"><button type="button" className="shcustomer-cancel-button" onClick={() => setPaymentSuccessBill(null)}>Close</button><button type="button" className="shcustomer-submit-payment" onClick={() => printBill(paymentSuccessBill)}>Print / Save PDF</button></div>
                    </section>
                </div>
            )}

            {/* PAYMENT HISTORY MODAL */}

            {historyBillId !== null && (
                <div
                    className="shcustomer-modal-overlay"
                    onClick={() => setHistoryBillId(null)}
                >
                    <section
                        className="shcustomer-payment-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="shcustomer-modal-header">
                            <div>
                                <h2>Payment History</h2>
                                <p>
                                    Bill: {
                                        customerBills.find(
                                            (bill) => bill.id === historyBillId
                                        )?.bill_number
                                    }
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setHistoryBillId(null)}
                            >
                                ×
                            </button>
                        </div>

                        {paymentHistoryLoading ? (
                            <p>Loading payment history...</p>
                        ) : paymentHistory.length === 0 ? (
                            <p className="shcustomers-empty">
                                No payment records found.
                            </p>
                        ) : (
                            <div className="shcustomer-history-table-wrapper">
                                <table className="shcustomers-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Mode</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {paymentHistory.map((payment) => (
                                            <tr key={payment.id}>
                                                <td>{formatDate(payment.payment_date)}</td>
                                                <td className="shcustomer-paid">
                                                    {money(payment.payment_amount)}
                                                </td>
                                                <td>{payment.payment_mode}</td>
                                                <td>{payment.remarks || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            )}

                    </section>
                </div>
            )}

        </main>
    );
}