import { useEffect, useState } from "react";
import "./GIHistory.css";

const API_URL = "https://pranali-jwellers-billing.onrender.com/api/gi";

const currency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(amount || 0));
};

const formatDate = (date) => {
    if (!date) return "-";

    const value = String(date).slice(0, 10);
    const [year, month, day] = value.split("-");

    return `${day}/${month}/${year}`;
};

function GIHistory() {

    const [history, setHistory] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedAccount, setSelectedAccount] = useState(null);

    // =================================
    // FETCH GI HISTORY
    // =================================

    const fetchHistory = async () => {

        try {

            setLoading(true);
            setError("");

            const response = await fetch(
                `${API_URL}/history?search=${encodeURIComponent(search)}`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || "Failed to fetch GI history.");
            }

            setHistory(data.history || []);

        } catch (err) {

            console.error("GI History Error:", err);
            setError(err.message);

        } finally {

            setLoading(false);

        }
    };

    useEffect(() => {

        const timer = setTimeout(() => {
            fetchHistory();
        }, 300);

        return () => clearTimeout(timer);

    }, [search]);

    // =================================
    // SUMMARY CALCULATIONS
    // =================================

    const totalAccounts = history.length;

    const totalPrincipal = history.reduce(
        (sum, account) =>
            sum + Number(account.original_principal || 0),
        0
    );

    const totalInterest = history.reduce(
        (sum, account) =>
            sum + Number(account.total_interest_paid || 0),
        0
    );

    const totalRecovered = history.reduce(
        (sum, account) =>
            sum + Number(account.total_recovered || 0),
        0
    );

    // =================================
    // RENDER
    // =================================

    return (

        <div className="gi-history-container">

            {/* HEADER */}

            <div className="gi-history-header">

                <div>
                    <h1>GI History</h1>

                    <p>
                        View completed Girvi accounts and payment records.
                    </p>
                </div>

                <button
                    className="gi-history-refresh"
                    onClick={fetchHistory}
                    disabled={loading}
                >
                    ↻ Refresh
                </button>

            </div>


            {/* SUMMARY CARDS */}

            <div className="gi-history-stats">

                <div className="gi-history-stat-card">
                    <span>Total Completed Accounts</span>
                    <h2>{totalAccounts}</h2>
                </div>

                <div className="gi-history-stat-card">
                    <span>Total Principal Given</span>
                    <h2>{currency(totalPrincipal)}</h2>
                </div>

                <div className="gi-history-stat-card">
                    <span>Total Interest Recovered</span>
                    <h2>{currency(totalInterest)}</h2>
                </div>

                <div className="gi-history-stat-card recovered-card">
                    <span>Total Amount Recovered</span>
                    <h2>{currency(totalRecovered)}</h2>
                </div>

            </div>


            {/* SEARCH */}

            <div className="gi-history-toolbar">

                <div className="gi-history-search">

                    <span>⌕</span>

                    <input
                        type="text"
                        placeholder="Search by GI number, customer name or mobile..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                </div>

                <span className="gi-history-count">
                    {history.length} Records
                </span>

            </div>


            {/* HISTORY TABLE */}

            <div className="gi-history-table-wrapper">

                <table className="gi-history-table">

                    <thead>

                        <tr>
                            <th>GI Number</th>
                            <th>Customer ID</th>
                            <th>Customer Name</th>
                            <th>Mobile</th>
                            <th>Item Name</th>
                            <th>Original Principal</th>
                            <th>Interest Paid</th>
                            <th>Principal Paid</th>
                            <th>Total Recovered</th>
                            <th>GI Date</th>
                            <th>Completion Date</th>
                            <th>Action</th>
                        </tr>

                    </thead>


                    <tbody>

                        {loading ? (

                            <tr>
                                <td colSpan="12" className="gi-history-message">
                                    Loading GI history...
                                </td>
                            </tr>

                        ) : error ? (

                            <tr>
                                <td colSpan="12" className="gi-history-message error">
                                    {error}
                                </td>
                            </tr>

                        ) : history.length === 0 ? (

                            <tr>
                                <td colSpan="12" className="gi-history-message">
                                    No completed GI accounts found.
                                </td>
                            </tr>

                        ) : (

                            history.map((account) => (

                                <tr key={account.gi_id}>

                                    <td className="history-gi-number">
                                        {account.gi_number}
                                    </td>

                                    <td>
                                        {account.customer_id}
                                    </td>

                                    <td>
                                        {account.customer_name}
                                    </td>

                                    <td>
                                        {account.customer_phone}
                                    </td>

                                    <td>
                                        {account.item_names || "-"}
                                    </td>

                                    <td>
                                        {currency(account.original_principal)}
                                    </td>

                                    <td>
                                        {currency(account.total_interest_paid)}
                                    </td>

                                    <td>
                                        {currency(account.total_principal_paid)}
                                    </td>

                                    <td className="history-recovered">
                                        {currency(account.total_recovered)}
                                    </td>

                                    <td>
                                        {formatDate(account.gi_date)}
                                    </td>

                                    <td>
                                        {formatDate(account.completed_at)}
                                    </td>

                                    <td>
                                        <button
                                            className="history-view-button"
                                            onClick={() => setSelectedAccount(account)}
                                        >
                                            View
                                        </button>
                                    </td>

                                </tr>

                            ))

                        )}

                    </tbody>

                </table>

            </div>


            {/* ACCOUNT DETAILS MODAL */}

            {selectedAccount && (

                <div
                    className="gi-history-modal-overlay"
                    onClick={() => setSelectedAccount(null)}
                >

                    <div
                        className="gi-history-modal"
                        onClick={(e) => e.stopPropagation()}
                    >

                        <div className="gi-history-modal-header">

                            <div>
                                <h2>GI Account Details</h2>
                                <p>{selectedAccount.gi_number}</p>
                            </div>

                            <button
                                onClick={() => setSelectedAccount(null)}
                            >
                                ×
                            </button>

                        </div>


                        {/* CUSTOMER DETAILS */}

                        <h3 className="history-section-title">
                            Customer Information
                        </h3>

                        <div className="history-details-grid">

                            <div>
                                <span>Customer ID</span>
                                <strong>{selectedAccount.customer_id}</strong>
                            </div>

                            <div>
                                <span>Customer Name</span>
                                <strong>{selectedAccount.customer_name}</strong>
                            </div>

                            <div>
                                <span>Mobile Number</span>
                                <strong>{selectedAccount.customer_phone}</strong>
                            </div>

                            <div>
                                <span>GI Number</span>
                                <strong>{selectedAccount.gi_number}</strong>
                            </div>

                            <div>
                                <span>GI Date</span>
                                <strong>{formatDate(selectedAccount.gi_date)}</strong>
                            </div>

                            <div>
                                <span>Completion Date</span>
                                <strong>{formatDate(selectedAccount.completed_at)}</strong>
                            </div>

                        </div>


                        {/* JEWELLERY DETAILS */}

                        <h3 className="history-section-title">
                            Deposited Jewellery
                        </h3>

                        <div className="history-items-list">

                            {selectedAccount.items?.length > 0 ? (

                                selectedAccount.items.map((item) => (

                                    <div
                                        className="history-item-card"
                                        key={item.id}
                                    >

                                        <strong>
                                            {item.item_name || item.item_type}
                                        </strong>

                                        <p>
                                            Type: {item.item_type || "-"}
                                        </p>

                                        <p>
                                            Purity: {item.purity || "-"}
                                        </p>

                                        <p>
                                            Gross Weight: {item.gross_weight} g
                                        </p>

                                        <p>
                                            Deduction: {item.deduction_weight} g
                                        </p>

                                        <p>
                                            Net Weight: {item.net_weight} g
                                        </p>

                                    </div>

                                ))

                            ) : (

                                <p>No jewellery details available.</p>

                            )}

                        </div>


                        {/* PAYMENT SUMMARY */}

                        <h3 className="history-section-title">
                            Payment Summary
                        </h3>

                        <div className="history-payment-summary">

                            <div>
                                <span>Original Principal</span>
                                <strong>
                                    {currency(selectedAccount.original_principal)}
                                </strong>
                            </div>

                            <div>
                                <span>Total Principal Paid</span>
                                <strong>
                                    {currency(selectedAccount.total_principal_paid)}
                                </strong>
                            </div>

                            <div>
                                <span>Total Interest Paid</span>
                                <strong>
                                    {currency(selectedAccount.total_interest_paid)}
                                </strong>
                            </div>

                            <div className="history-final-total">
                                <span>Total Recovered</span>
                                <strong>
                                    {currency(selectedAccount.total_recovered)}
                                </strong>
                            </div>

                        </div>

                        <div className="history-completed-badge">
                            ACCOUNT COMPLETED
                        </div>

                    </div>

                </div>

            )}

        </div>

    );

}

export default GIHistory;