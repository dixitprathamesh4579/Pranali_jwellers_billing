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

            setPaymentMessage("Payment recorded successfully!");

            setSelectedPaymentBill(null);

            await refreshCustomerDetails();

        } catch (err) {
            setPaymentMessage(err.message || "Payment failed.");
        } finally {
            setPaymentLoading(false);
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
                        {historyLoading ? (
                            <p className="shcustomers-empty">
                                Loading bill history...
                            </p>
                        ) : customerBills.length === 0 ? (
                            <p className="shcustomers-empty">
                                No bill history found.
                            </p>
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
                                        </tr>
                                    </thead>

                                    <tbody>

                                        {customerBills.map((bill) => (

                                            <tr key={bill.id}>
                                                <td>{bill.bill_number}</td>
                                                <td>{formatDate(bill.bill_date)}</td>
                                                <td>{bill.billing_type}</td>
                                                <td>{money(bill.grand_total)}</td>
                                                <td>{money(bill.paid_amount)}</td>
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
                                            </tr>

                                        ))}

                                    </tbody>

                                </table>

                            </div>

                        )}

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

        </main>
    );
}