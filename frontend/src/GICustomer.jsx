import { useState, useEffect } from "react";
import "./GICustomer.css";

function GICustomer() {
    const [search, setSearch] = useState("");
    const [activeFilter, setActiveFilter] = useState("ALL");


    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [paymentError, setPaymentError] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const [paymentType, setPaymentType] = useState("INTEREST");
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentDate, setPaymentDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [paymentDescription, setPaymentDescription] = useState("");

    const getTodayDate = () => {
        const today = new Date();

        return [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0")
        ].join("-");
    };

    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        paymentDate: getTodayDate(),
        paymentMethod: "CASH",
        description: ""
    });

    const currency = (amount) =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2,
        }).format(Number(amount || 0));

    // FETCH GI CUSTOMERS FROM BACKEND
    const fetchCustomers = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `http://localhost:5000/api/gi/customers?search=${encodeURIComponent(search)}`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Failed to fetch GI customers."
                );
            }

            setCustomers(data.customers || []);

        } catch (err) {
            console.error("Fetch GI Customers Error:", err);
            setError(err.message || "Unable to connect to server.");

        } finally {
            setLoading(false);
        }
    };

    // FETCH DATA WHEN PAGE LOADS AND SEARCH CHANGES
    useEffect(() => {
        const delay = setTimeout(() => {
            fetchCustomers();
        }, 300);

        return () => clearTimeout(delay);
    }, [search]);

    // FILTER CUSTOMERS
    const filteredCustomers = customers.filter((customer) => {
        const matchesStatus =
            activeFilter === "ALL" ||
            customer.account_status === activeFilter;

        return matchesStatus;
    });

    // SUMMARY CALCULATIONS
    const activeCount = customers.filter(
        (customer) => customer.account_status === "ACTIVE"
    ).length;

    const completedCount = customers.filter(
        (customer) => customer.account_status === "COMPLETED"
    ).length;

    const totalPrincipal = customers.reduce(
        (total, customer) =>
            total + Number(customer.principal || 0),
        0
    );
    // OPEN PAYMENT MODAL
    const openPaymentModal = (customer) => {
        setSelectedCustomer(customer);
        setPaymentType("FULL_SETTLEMENT");
        setPaymentAmount("");
        setPaymentDate(new Date().toISOString().split("T")[0]);
        setPaymentMethod("CASH");
        setPaymentDescription("");
        setShowPaymentModal(true);
    };


    // SUBMIT PAYMENT
    const handlePaymentSubmit = async (e) => {
        e.preventDefault();

        if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
            setPaymentError("Please enter a valid payment amount.");
            return;
        }

        try {
            setPaymentLoading(true);
            setPaymentError("");

            const response = await fetch(
                "http://localhost:5000/api/gi/payment",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        giAccountId: selectedAccount.gi_id,
                        amount: Number(paymentForm.amount),
                        paymentDate: paymentForm.paymentDate,
                        paymentMethod: paymentForm.paymentMethod,
                        description: paymentForm.description
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Payment failed.");
            }

            alert(
                `Payment recorded successfully!\n\n` +
                `GI Number: ${data.payment.giNumber}\n` +
                `Amount Paid: ${currency(data.payment.amount)}\n` +
                `Remaining Due: ${currency(data.payment.totalRemaining)}`
            );

            setShowPaymentModal(false);
            setSelectedAccount(null);

            // Refresh GI customer records
            await fetchCustomers();

        } catch (error) {
            console.error("Payment Error:", error);
            setPaymentError(error.message);

        } finally {
            setPaymentLoading(false);
        }
    };
    const handleGIPayment = async (e) => {
        e.preventDefault();

        if (!selectedCustomer) {
            alert("Please select a GI customer.");
            return;
        }

        const amount = Number(paymentAmount);

        if (!amount || amount <= 0) {
            alert("Please enter a valid payment amount.");
            return;
        }

        let outstandingAmount;

        if (paymentType === "INTEREST") {
            outstandingAmount = Number(selectedCustomer.interest_amount);
        } else if (paymentType === "PRINCIPAL") {
            outstandingAmount = Number(selectedCustomer.principal);
        } else {
            outstandingAmount = Number(selectedCustomer.total_due);
        }
        const paymentData = {
            giAccountId: selectedCustomer.gi_id,
            amount,
            paymentType,
            paymentDate,
            paymentMethod,
            description: paymentDescription
        };

        try {
            const response = await fetch(
                "http://localhost:5000/api/gi/payment",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(paymentData)
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Payment failed.");
            }

            alert("GI Payment recorded successfully!");

            setShowPaymentModal(false);
            setSelectedCustomer(null);

            // Refresh GI customer records
            await fetchCustomers();

        } catch (error) {
            console.error("GI Payment Error:", error);
            alert(error.message || "Unable to record payment.");
        }
    };
    return (
        <div className="gi-customer-page">

            {/* Page Header */}
            <div className="gi-customer-header">
                <div>
                    <h1>GI Customers</h1>
                    <p>Manage Girvi accounts, customer details and payments.</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="gi-customer-stats">

                <div className="gi-customer-stat-card">
                    <div>
                        <p>Total GI Accounts</p>
                        <h2>{customers.length}</h2>
                    </div>
                    <span className="gi-stat-icon">◇</span>
                </div>

                <div className="gi-customer-stat-card">
                    <div>
                        <p>Active Accounts</p>
                        <h2>{activeCount}</h2>
                    </div>
                    <span className="gi-stat-icon active-icon">✓</span>
                </div>

                <div className="gi-customer-stat-card">
                    <div>
                        <p>Completed Accounts</p>
                        <h2>{completedCount}</h2>
                    </div>
                    <span className="gi-stat-icon completed-icon">✓</span>
                </div>

                <div className="gi-customer-stat-card">
                    <div>
                        <p>Active Principal</p>
                        <h2>{currency(totalPrincipal)}</h2>
                    </div>
                    <span className="gi-stat-icon">₹</span>
                </div>

            </div>

            {/* Customer List */}
            <section className="gi-customer-panel">

                <div className="gi-customer-panel-header">
                    <div>
                        <h2>GI Account Records</h2>
                        <p>Search and manage your Girvi customers.</p>
                    </div>

                    <span className="gi-record-count">
                        {filteredCustomers.length} Records
                    </span>
                </div>

                {/* Search and Filters */}
                <div className="gi-customer-controls">

                    <div className="gi-search-box">
                        <span>⌕</span>

                        <input
                            type="text"
                            placeholder="Search GI number, customer or mobile..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="gi-filter-buttons">
                        {["ALL", "ACTIVE", "COMPLETED"].map((filter) => (
                            <button
                                key={filter}
                                type="button"
                                className={
                                    activeFilter === filter ? "selected" : ""
                                }
                                onClick={() => setActiveFilter(filter)}
                            >
                                {filter === "ALL" ? "All Accounts" : filter}
                            </button>
                        ))}
                    </div>

                </div>

                {/* Table */}
                <div className="gi-customer-table-wrapper">

                    <table className="gi-customer-table">

                        <thead>
                            <tr>
                                <th>GI Number</th>
                                <th>Customer Name</th>
                                <th>Item Name</th>
                                <th>Mobile Number</th>
                                <th>Principal</th>
                                <th>Interest</th>
                                <th>Total Due</th>
                                <th>GI Date</th>
                                <th>Last Payment Amount</th>
                                <th>Last Payment Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>

                            {loading ? (
                                <tr>
                                    <td colSpan="10" className="gi-empty-state">
                                        Loading GI customers...
                                    </td>
                                </tr>

                            ) : error ? (
                                <tr>
                                    <td colSpan="7" className="gi-empty-state">
                                        {error}
                                        <br />
                                        <button
                                            type="button"
                                            onClick={fetchCustomers}
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>

                            ) : filteredCustomers.length > 0 ? (

                                filteredCustomers.map((customer) => (

                                    <tr key={customer.gi_id}>

                                        <td className="gi-number-cell">
                                            {customer.gi_number}
                                        </td>

                                        <td>{customer.customer_name}</td>

                                        <td>{customer.item_names || "-"}</td>

                                        <td>{customer.customer_phone}</td>

                                        <td>
                                            {currency(customer.principal)}
                                        </td>

                                        {/* Outstanding Interest */}
                                        <td>
                                            {currency(customer.interest_amount)}
                                        </td>

                                        {/* Total Amount Due */}
                                        <td>
                                            {currency(customer.total_due)}
                                        </td>

                                        <td>
                                            {customer.gi_date
                                                ? new Date(customer.gi_date).toLocaleDateString("en-IN")
                                                : "-"}
                                        </td>
                                        <td>
                                            {customer.last_payment_amount != null
                                                ? currency(customer.last_payment_amount)
                                                : "-"}
                                        </td>

                                        <td>
                                            {customer.last_payment_date
                                                ? new Date(customer.last_payment_date).toLocaleDateString("en-IN")
                                                : "-"}
                                        </td>
                                        <td>
                                            <span
                                                className={`gi-customer-status ${customer.account_status === "ACTIVE"
                                                    ? "status-active"
                                                    : "status-completed"
                                                    }`}
                                            >
                                                {customer.account_status}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="gi-action-buttons">

                                                <button
                                                    type="button"
                                                    className="gi-view-button"
                                                    onClick={() =>
                                                        alert(`Details for ${customer.gi_number}`)
                                                    }
                                                >
                                                    View
                                                </button>

                                                {customer.account_status === "ACTIVE" && (
                                                    <button
                                                        type="button"
                                                        className="gi-payment-button"
                                                        onClick={() => openPaymentModal(customer)}
                                                    >
                                                        Payment
                                                    </button>
                                                )}

                                            </div>
                                        </td>

                                    </tr>

                                ))
                            ) : (

                                <tr>
                                    <td colSpan="7" className="gi-empty-state">
                                        No GI customer records found.
                                    </td>
                                </tr>

                            )}

                        </tbody>

                    </table>

                </div>

            </section>
            {showPaymentModal && selectedAccount && (
                <div className="gi-modal-overlay">
                    <div className="gi-payment-modal">

                        <h2>Record GI Payment</h2>

                        <p>
                            GI Number: <strong>{selectedAccount.gi_number}</strong>
                        </p>

                        <p>
                            Customer: <strong>{selectedAccount.customer_name}</strong>
                        </p>

                        <form onSubmit={handlePaymentSubmit}>

                            <label>
                                Payment Amount (₹)

                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={paymentForm.amount}
                                    onChange={(e) =>
                                        setPaymentForm({
                                            ...paymentForm,
                                            amount: e.target.value
                                        })
                                    }
                                    placeholder="0.00"
                                />
                            </label>

                            <label>
                                Payment Date

                                <input
                                    type="date"
                                    value={paymentForm.paymentDate}
                                    onChange={(e) =>
                                        setPaymentForm({
                                            ...paymentForm,
                                            paymentDate: e.target.value
                                        })
                                    }
                                    required
                                />
                            </label>

                            <label>
                                Payment Method

                                <select
                                    value={paymentForm.paymentMethod}
                                    onChange={(e) =>
                                        setPaymentForm({
                                            ...paymentForm,
                                            paymentMethod: e.target.value
                                        })
                                    }
                                >
                                    <option value="CASH">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="BANK">Bank Transfer</option>
                                    <option value="CHEQUE">Cheque</option>
                                </select>
                            </label>

                            <label>
                                Description

                                <textarea
                                    value={paymentForm.description}
                                    onChange={(e) =>
                                        setPaymentForm({
                                            ...paymentForm,
                                            description: e.target.value
                                        })
                                    }
                                    placeholder="Enter payment description"
                                />
                            </label>

                            {paymentError && (
                                <p className="gi-payment-error">
                                    {paymentError}
                                </p>
                            )}

                            <div className="gi-modal-actions">

                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    disabled={paymentLoading}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={paymentLoading}
                                >
                                    {paymentLoading ? "Processing..." : "Submit Payment"}
                                </button>

                            </div>

                        </form>
                    </div>
                </div>
            )}
            {showPaymentModal && selectedCustomer && (
                <div className="gi-modal-overlay">

                    <div className="gi-payment-modal">

                        <div className="gi-modal-header">
                            <div>
                                <h2>GI Payment</h2>
                                <p>{selectedCustomer.gi_number}</p>
                            </div>

                            <button
                                type="button"
                                className="gi-modal-close"
                                onClick={() => setShowPaymentModal(false)}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="gi-payment-customer">
                            <h3>{selectedCustomer.customer_name}</h3>
                            <p>{selectedCustomer.customer_phone}</p>
                        </div>

                        <div className="gi-payment-summary">

                            <div>
                                <span>Principal</span>
                                <strong>{currency(selectedCustomer.principal)}</strong>
                            </div>

                            <div>
                                <span>Outstanding Interest</span>
                                <strong>
                                    {currency(selectedCustomer.interest_amount)}
                                </strong>
                            </div>

                            <div className="gi-total-due">
                                <span>Total Amount Due</span>
                                <strong>
                                    {currency(selectedCustomer.total_due)}
                                </strong>
                            </div>

                        </div>

                        <form onSubmit={handleGIPayment}>

                            <div className="gi-form-group">
                                <label>Payment Type</label>

                                <select
                                    value={paymentType}
                                    onChange={(e) => {
                                        setPaymentType(e.target.value);
                                        setPaymentAmount("");
                                    }}
                                >
                                    <option value="INTEREST">
                                        Total Interest Payment
                                    </option>

                                    <option value="PRINCIPAL">
                                        Principal Payment
                                    </option>

                                    <option value="FULL_SETTLEMENT">
                                        Full Settlement (Interest + Principal)
                                    </option>
                                </select>
                            </div>

                            <div className="gi-form-group">
                                <label>Payment Amount (₹)</label>


                                <input
                                    type="number"
                                    inputMode="decimal"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}

                                    placeholder="0.00"
                                />
                            </div>

                            <div className="gi-form-group">
                                <label>Payment Date</label>

                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    max={new Date().toISOString().split("T")[0]}
                                    required
                                />
                            </div>

                            <div className="gi-form-group">
                                <label>Payment Method</label>

                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                >
                                    <option value="CASH">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="BANK">Bank Transfer</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>

                            <div className="gi-form-group">
                                <label>Description (Optional)</label>

                                <textarea
                                    value={paymentDescription}
                                    onChange={(e) =>
                                        setPaymentDescription(e.target.value)
                                    }
                                    placeholder="Enter payment details"
                                />
                            </div>

                            <div className="gi-modal-actions">

                                <button
                                    type="button"
                                    className="gi-cancel-button"
                                    onClick={() => setShowPaymentModal(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="gi-submit-button"
                                >
                                    Submit Payment
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}
        </div>
    );


}

export default GICustomer;
