import { useMemo, useState } from "react";
import "./NewGi.css";

const makeGIItem = () => ({
    id: Date.now() + Math.random(),
    itemType: "Gold",
    itemName: "",
    purity: "",
    grossWeight: "",
    deductionWeight: "0",
    description: "",
});

const formatMoney = (amount) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount || 0);

const getInterestDetails = (principal, rate, startDate) => {
    if (!principal || !startDate) {
        return {
            completedMonths: 0,
            remainingDays: 0,
            interest: 0,
            total: principal || 0,
        };
    }

    const start = new Date(`${startDate}T00:00:00`);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (start > today) {
        return {
            completedMonths: 0,
            remainingDays: 0,
            interest: 0,
            total: principal,
        };
    }

    let completedMonths =
        (today.getFullYear() - start.getFullYear()) * 12 +
        today.getMonth() -
        start.getMonth();

    let anniversary = new Date(start);
    anniversary.setMonth(
        anniversary.getMonth() + completedMonths
    );

    if (anniversary > today) {
        completedMonths--;
        anniversary = new Date(start);
        anniversary.setMonth(
            anniversary.getMonth() + completedMonths
        );
    }

    const remainingDays = Math.floor(
        (today - anniversary) / (1000 * 60 * 60 * 24)
    );

    const monthlyInterest = principal * (rate / 100);

    let interest = completedMonths * monthlyInterest;

    if (remainingDays > 0 && remainingDays <= 15) {
        interest += monthlyInterest / 2;
    } else if (remainingDays > 15) {
        interest += monthlyInterest;
    }

    return {
        completedMonths,
        remainingDays,
        interest,
        total: principal + interest,
    };
};

export default function NewGIBill() {
    const [customer, setCustomer] = useState({
        name: "",
        phone: "",
        address: "",
        idReference: "",
    });

    const [items, setItems] = useState([makeGIItem()]);

    const [principal, setPrincipal] = useState("");
    const [interestRate, setInterestRate] = useState("3");
    const [girviDate, setGirviDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [isSaving, setIsSaving] = useState(false);
    const [savedGINumber, setSavedGINumber] = useState("");
    const [saveError, setSaveError] = useState("");
    const [saveSuccess, setSaveSuccess] = useState("");

    const interestDetails = useMemo(
        () =>
            getInterestDetails(
                Number(principal) || 0,
                Number(interestRate) || 0,
                girviDate
            ),
        [principal, interestRate, girviDate]
    );

    const updateCustomer = (field, value) => {
        setCustomer((old) => ({
            ...old,
            [field]: value,
        }));
    };

    const updateItem = (id, field, value) => {
        setItems((old) =>
            old.map((item) =>
                item.id === id
                    ? { ...item, [field]: value }
                    : item
            )
        );
    };

    const addItem = () => {
        setItems((old) => [...old, makeGIItem()]);
    };

    const removeItem = (id) => {
        setItems((old) =>
            old.length > 1
                ? old.filter((item) => item.id !== id)
                : old
        );
    };
    // ==========================================
    // SAVE NEW GI ACCOUNT
    // ==========================================

    const handleSaveGI = async () => {
        if (isSaving) return;

        setSaveError("");
        setSaveSuccess("");

        // Customer validation
        if (!customer.name.trim()) {
            setSaveError("Please enter customer name.");
            return;
        }

        if (!/^\d{10}$/.test(customer.phone)) {
            setSaveError("Please enter a valid 10-digit mobile number.");
            return;
        }

        // Item validation
        for (const item of items) {
            if (!item.grossWeight || Number(item.grossWeight) <= 0) {
                setSaveError("Please enter valid gross weight for all items.");
                return;
            }

            if (
                Number(item.deductionWeight || 0) >
                Number(item.grossWeight)
            ) {
                setSaveError("Deduction weight cannot exceed gross weight.");
                return;
            }
        }

        // Principal validation
        if (!principal || Number(principal) <= 0) {
            setSaveError("Please enter a valid principal amount.");
            return;
        }

        if (!girviDate) {
            setSaveError("Please select GI date.");
            return;
        }

        const requestData = {
            customer: {
                name: customer.name.trim(),
                phone: customer.phone,
                address: customer.address,
                idReference: customer.idReference
            },

            items: items.map((item) => ({
                itemType: item.itemType,
                itemName: item.itemName,
                purity: item.purity,
                grossWeight: Number(item.grossWeight),
                deductionWeight: Number(item.deductionWeight || 0),
                description: item.description
            })),

            principal: Number(principal),
            interestRate: Number(interestRate),
            girviDate: girviDate
        };

        try {
            setIsSaving(true);

            const response = await fetch(
                "http://localhost:5000/api/gi",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestData)
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Failed to create GI account."
                );
            }

            setSavedGINumber(data.gi.gi_number);

            setSaveSuccess(
                `GI Account ${data.gi.gi_number} created successfully!`
            );

        } catch (error) {
            console.error("Save GI Error:", error);

            setSaveError(
                error.message || "Unable to connect to backend."
            );

        } finally {
            setIsSaving(false);
        }
    };
    return (
        <main className="gi-page">
            <div className="gi-page-header">
                <div>
                    <span className="gi-eyebrow">PRANALI JEWELLERS</span>
                    <h1>New GI Entry</h1>
                    <p>Register a new Girvi transaction.</p>
                </div>

                <div className="gi-number-card">
                    <span>GI Number</span>
                    <strong>
                        {savedGINumber || "Generated on Save"}
                    </strong>
                    <small>Generated automatically</small>
                </div>
            </div>

            <div className="gi-layout">
                <div className="gi-main">

                    {/* SECTION 01 - CUSTOMER DETAILS */}

                    <section className="gi-card">
                        <div className="gi-section-heading">
                            <span>01</span>
                            <div>
                                <h2>Customer Details</h2>
                                <p>Enter the customer's personal information.</p>
                            </div>
                        </div>

                        <div className="gi-fields">
                            <label>
                                Customer Name <b>*</b>
                                <input
                                    type="text"
                                    value={customer.name}
                                    onChange={(e) =>
                                        updateCustomer("name", e.target.value)
                                    }
                                    placeholder="Enter customer name"
                                />
                            </label>

                            <label>
                                Contact Number <b>*</b>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={customer.phone}
                                    onChange={(e) =>
                                        updateCustomer(
                                            "phone",
                                            e.target.value.replace(/\D/g, "").slice(0, 10)
                                        )
                                    }
                                    placeholder="Enter 10-digit mobile number"
                                />
                            </label>

                            <label className="gi-full">
                                Address
                                <textarea
                                    rows="3"
                                    value={customer.address}
                                    onChange={(e) =>
                                        updateCustomer("address", e.target.value)
                                    }
                                    placeholder="Enter complete address"
                                />
                            </label>

                            <label className="gi-full">
                                Aadhaar / ID Reference (Optional)
                                <input
                                    type="text"
                                    value={customer.idReference}
                                    onChange={(e) =>
                                        updateCustomer("idReference", e.target.value)
                                    }
                                    placeholder="Enter optional ID reference"
                                />
                            </label>
                        </div>
                    </section>

                    {/* SECTION 02 - GIRVI ITEMS */}

                    <section className="gi-card">
                        <div className="gi-section-heading gi-heading-between">
                            <div className="gi-heading-left">
                                <span>02</span>
                                <div>
                                    <h2>Girvi Item Details</h2>
                                    <p>Details of Gold, Silver or other deposited items.</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="gi-add-button"
                                onClick={addItem}
                            >
                                + Add Item
                            </button>
                        </div>

                        {items.map((item, index) => {
                            const netWeight = Math.max(
                                0,
                                (Number(item.grossWeight) || 0) -
                                (Number(item.deductionWeight) || 0)
                            );

                            return (
                                <div className="gi-item-card" key={item.id}>
                                    <div className="gi-item-heading">
                                        <div>
                                            <strong>Item {index + 1}</strong>
                                            <small>Deposited jewellery details</small>
                                        </div>

                                        <button
                                            type="button"
                                            className="gi-remove-button"
                                            onClick={() => removeItem(item.id)}
                                            disabled={items.length === 1}
                                        >
                                            Remove
                                        </button>
                                    </div>

                                    <div className="gi-fields">
                                        <label>
                                            Item Type
                                            <select
                                                value={item.itemType}
                                                onChange={(e) =>
                                                    updateItem(item.id, "itemType", e.target.value)
                                                }
                                            >
                                                <option>Gold</option>
                                                <option>Silver</option>
                                                <option>Other</option>
                                            </select>
                                        </label>

                                        <label>
                                            Item Name
                                            <input
                                                type="text"
                                                value={item.itemName}
                                                onChange={(e) =>
                                                    updateItem(item.id, "itemName", e.target.value)
                                                }
                                                placeholder="e.g. Gold Chain"
                                            />
                                        </label>
                                        {(item.itemType === "Silver" || item.itemType === "Other") && (
                                            <label>
                                                Purity (%)
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={item.purity}
                                                    onChange={(e) =>
                                                        updateItem(
                                                            item.id,
                                                            "purity",
                                                            e.target.value.replace(/[^0-9.]/g, "")
                                                        )
                                                    }
                                                    placeholder="Enter purity (e.g. 91.6)"
                                                />
                                            </label>
                                        )}
                                        {item.itemType === "Gold" && (
                                            <label>
                                                Purity (Karat)
                                                <select
                                                    value={item.purity}
                                                    onChange={(e) =>
                                                        updateItem(item.id, "purity", e.target.value)
                                                    }
                                                >
                                                    <option>24K</option>
                                                    <option>22K</option>
                                                    <option>20K</option>
                                                    <option>18K</option>
                                                    <option>14K</option>
                                                    <option>9K</option>
                                                </select>
                                            </label>
                                        )}

                                        <label>
                                            Gross Weight (g)
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={item.grossWeight}
                                                onChange={(e) =>
                                                    updateItem(
                                                        item.id,
                                                        "grossWeight",
                                                        e.target.value.replace(/[^0-9.]/g, "")
                                                    )
                                                }
                                                placeholder="0.000"
                                            />
                                        </label>

                                        <label>
                                            Deduction Weight (g)
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={item.deductionWeight}
                                                onChange={(e) =>
                                                    updateItem(
                                                        item.id,
                                                        "deductionWeight",
                                                        e.target.value.replace(/[^0-9.]/g, "")
                                                    )
                                                }
                                                placeholder="0.000"
                                            />
                                        </label>

                                        <label>
                                            Net Weight (g)
                                            <input
                                                type="text"
                                                value={netWeight.toFixed(3)}
                                                readOnly
                                            />
                                        </label>

                                        <label className="gi-full">
                                            Description / Identification
                                            <textarea
                                                rows="2"
                                                value={item.description}
                                                onChange={(e) =>
                                                    updateItem(item.id, "description", e.target.value)
                                                }
                                                placeholder="Describe identifying marks or other details"
                                            />
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </section>

                    {/* SECTION 03 - MONEY DETAILS */}

                    <section className="gi-card">
                        <div className="gi-section-heading">
                            <span>03</span>
                            <div>
                                <h2>Money & Interest Details</h2>
                                <p>Enter the amount given and interest conditions.</p>
                            </div>
                        </div>

                        <div className="gi-fields">
                            <label>
                                Amount Given (₹) <b>*</b>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={principal}
                                    onChange={(e) =>
                                        setPrincipal(
                                            e.target.value.replace(/[^0-9.]/g, "")
                                        )
                                    }
                                    placeholder="Enter amount"
                                />
                            </label>

                            <label>
                                Interest Rate (% per month) <b>*</b>
                                <select
                                    value={interestRate}
                                    onChange={(e) =>
                                        setInterestRate(e.target.value)
                                    }
                                >
                                    <option value="1">1%</option>
                                    <option value="2">2%</option>
                                    <option value="3">3% (Default)</option>
                                    <option value="4">4%</option>
                                    <option value="5">5%</option>
                                </select>
                            </label>

                            <label>
                                Date of Girvi <b>*</b>
                                <input
                                    type="date"
                                    value={girviDate}
                                    onChange={(e) =>
                                        setGirviDate(e.target.value)
                                    }
                                />
                            </label>
                        </div>
                    </section>

                </div>

                {/* RIGHT SUMMARY PANEL */}

                <aside className="gi-summary">
                    <div className="gi-summary-header">
                        <span>GI SUMMARY</span>
                        <h2>Interest Calculation</h2>
                    </div>

                    <div className="gi-summary-principal">
                        <span>Amount Given</span>
                        <strong>{formatMoney(Number(principal) || 0)}</strong>
                    </div>

                    <div className="gi-summary-details">
                        <div>
                            <span>Interest Rate</span>
                            <strong>{interestRate}% / month</strong>
                        </div>

                        <div>
                            <span>Completed Months</span>
                            <strong>{interestDetails.completedMonths}</strong>
                        </div>

                        <div>
                            <span>Remaining Days</span>
                            <strong>{interestDetails.remainingDays}</strong>
                        </div>

                        <div>
                            <span>Interest Amount</span>
                            <strong>{formatMoney(interestDetails.interest)}</strong>
                        </div>
                    </div>

                    <div className="gi-summary-total">
                        <span>Total Amount with Interest</span>
                        <strong>{formatMoney(interestDetails.total)}</strong>
                    </div>

                    <div className="gi-interest-note">
                        <strong>Interest Rules</strong>
                        <p>• 1–15 remaining days: Half monthly interest.</p>
                        <p>• More than 15 days: Full monthly interest.</p>
                        <p>• Interest is calculated on the original amount.</p>
                    </div>

                    <button
                        type="button"
                        className="gi-save-button"
                        onClick={handleSaveGI}
                        disabled={isSaving || !!savedGINumber}
                    >
                        {isSaving ? "Saving..." : savedGINumber ? "GI Saved" : "Save GI"}
                    </button>
                    {saveError && (
                        <p style={{ color: "#dc2626", marginTop: "10px" }}>
                            {saveError}
                        </p>
                    )}

                    {saveSuccess && (
                        <p style={{ color: "#15803d", marginTop: "10px" }}>
                            {saveSuccess}
                        </p>
                    )}

                    <p className="gi-summary-footer">
                        Please verify all customer and item details before saving.
                    </p>
                </aside>
            </div>
        </main>
    );
}