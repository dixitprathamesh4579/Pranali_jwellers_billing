import { useEffect, useState } from "react";
import "./GIStatistics.css";

const API_URL = "https://pranali-jwellers-billing.onrender.com/api/gi/statistics";

function GIStatistics() {
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchStatistics = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(API_URL);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Failed to fetch GI statistics."
                );
            }

            setStatistics(data.statistics);

        } catch (err) {
            console.error("GI Statistics Error:", err);
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatistics();
    }, []);

    const currency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(Number(amount || 0));
    };

    if (loading) {
        return (
            <div className="gi-stats-loading">
                <div className="gi-stats-spinner"></div>
                <p>Loading GI Statistics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="gi-stats-error">
                <h3>Unable to Load Statistics</h3>
                <p>{error}</p>
                <button onClick={fetchStatistics}>
                    Try Again
                </button>
            </div>
        );
    }

    if (!statistics) return null;

    const accountPercentage =
        statistics.total_accounts > 0
            ? (statistics.active_accounts / statistics.total_accounts) * 100
            : 0;

    const completedPercentage =
        statistics.total_accounts > 0
            ? (statistics.completed_accounts / statistics.total_accounts) * 100
            : 0;

    const recoveryPercentage =
        statistics.total_principal_disbursed > 0
            ? Math.min(
                100,
                (statistics.total_principal_recovered /
                    statistics.total_principal_disbursed) * 100
            )
            : 0;

    return (
        <div className="gi-statistics-page">

            {/* HEADER */}
            <div className="gi-stats-header">
                <div>
                    <h2>GI Statistics</h2>
                    <p>Overview of Girvi accounts, payments and recovery</p>
                </div>

                <button
                    className="gi-stats-refresh"
                    onClick={fetchStatistics}
                >
                    ↻ Refresh
                </button>
            </div>


            {/* ACCOUNT SUMMARY */}
            <div className="gi-stats-section-title">
                <h3>Account Overview</h3>
            </div>

            <div className="gi-stats-grid">

                <div className="gi-stat-card">
                    <div className="gi-stat-icon purple">▣</div>
                    <div>
                        <p>Total Accounts</p>
                        <h2>{statistics.total_accounts}</h2>
                    </div>
                </div>

                <div className="gi-stat-card">
                    <div className="gi-stat-icon green">✓</div>
                    <div>
                        <p>Active Accounts</p>
                        <h2>{statistics.active_accounts}</h2>
                    </div>
                </div>

                <div className="gi-stat-card">
                    <div className="gi-stat-icon blue">✓</div>
                    <div>
                        <p>Completed Accounts</p>
                        <h2>{statistics.completed_accounts}</h2>
                    </div>
                </div>

            </div>


            {/* OUTSTANDING SUMMARY */}
            <div className="gi-stats-section-title">
                <h3>Outstanding Amount</h3>
            </div>

            <div className="gi-stats-grid">

                <div className="gi-stat-card">
                    <div className="gi-stat-icon orange">₹</div>
                    <div>
                        <p>Outstanding Principal</p>
                        <h2>{currency(statistics.outstanding_principal)}</h2>
                    </div>
                </div>

                <div className="gi-stat-card">
                    <div className="gi-stat-icon red">₹</div>
                    <div>
                        <p>Outstanding Interest</p>
                        <h2>{currency(statistics.outstanding_interest)}</h2>
                    </div>
                </div>

                <div className="gi-stat-card gi-stat-highlight">
                    <div className="gi-stat-icon dark">₹</div>
                    <div>
                        <p>Total Outstanding</p>
                        <h2>{currency(statistics.total_outstanding)}</h2>
                    </div>
                </div>

            </div>


            {/* RECOVERY SUMMARY */}
            <div className="gi-stats-section-title">
                <h3>Recovery Overview</h3>
            </div>

            <div className="gi-stats-grid">

                <div className="gi-stat-card">
                    <div className="gi-stat-icon blue">₹</div>
                    <div>
                        <p>Principal Recovered</p>
                        <h2>{currency(statistics.total_principal_recovered)}</h2>
                    </div>
                </div>

                <div className="gi-stat-card">
                    <div className="gi-stat-icon green">₹</div>
                    <div>
                        <p>Interest Recovered</p>
                        <h2>{currency(statistics.total_interest_recovered)}</h2>
                    </div>
                </div>

                <div className="gi-stat-card gi-stat-highlight">
                    <div className="gi-stat-icon dark">₹</div>
                    <div>
                        <p>Total Recovered</p>
                        <h2>{currency(statistics.total_recovered)}</h2>
                    </div>
                </div>

            </div>


            {/* ANALYTICS */}
            <div className="gi-stats-section-title">
                <h3>GI Analytics</h3>
            </div>

            <div className="gi-stats-analytics">

                {/* ACCOUNT DISTRIBUTION */}
                <div className="gi-analytics-card">

                    <h3>Account Distribution</h3>

                    <div className="gi-progress-item">
                        <div className="gi-progress-label">
                            <span>Active Accounts</span>
                            <strong>
                                {statistics.active_accounts}
                            </strong>
                        </div>

                        <div className="gi-progress-track">
                            <div
                                className="gi-progress-fill active-fill"
                                style={{ width: `${accountPercentage}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="gi-progress-item">
                        <div className="gi-progress-label">
                            <span>Completed Accounts</span>
                            <strong>
                                {statistics.completed_accounts}
                            </strong>
                        </div>

                        <div className="gi-progress-track">
                            <div
                                className="gi-progress-fill completed-fill"
                                style={{ width: `${completedPercentage}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="gi-account-total">
                        <span>Total Accounts</span>
                        <strong>{statistics.total_accounts}</strong>
                    </div>

                </div>


                {/* RECOVERY DISTRIBUTION */}
                <div className="gi-analytics-card">

                    <h3>Principal Recovery</h3>

                    <div className="gi-recovery-percentage">
                        {recoveryPercentage.toFixed(1)}%
                    </div>

                    <p className="gi-recovery-subtitle">
                        Principal recovered against total principal disbursed
                    </p>

                    <div className="gi-progress-track gi-recovery-track">
                        <div
                            className="gi-progress-fill recovery-fill"
                            style={{ width: `${recoveryPercentage}%` }}
                        ></div>
                    </div>

                    <div className="gi-recovery-details">
                        <div>
                            <span>Disbursed</span>
                            <strong>
                                {currency(statistics.total_principal_disbursed)}
                            </strong>
                        </div>

                        <div>
                            <span>Recovered</span>
                            <strong>
                                {currency(statistics.total_principal_recovered)}
                            </strong>
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}

export default GIStatistics;