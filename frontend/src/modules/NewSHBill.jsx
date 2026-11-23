import { useMemo, useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import pranaliLogo from "../assets/pranali-jewellers-logo.png?inline";
import bisHallmarkLogo from "../assets/bis-hallmark-logo.png?inline";

import "./NewSHBill.css";

import BillPageHeading from "../components/BillPageHeading.jsx";
import BillFooter from "../components/BillFooter.jsx";
import BillSummary from "../components/BillSummary.jsx";

import { apiFetch } from "../utils/api.js";

// ---------------- CREATE ITEM ----------------

const makeItem = () => ({
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: "",
    metal: "Gold",
    weight: "",
    purity: "22K",
    rate: "",
    makingCharges: "",
});

const makeExchangeItem = () => ({
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    metal: "Gold",
    description: "",
    purity: "22K",
    grossWeight: "",
    deductionWeight: "0",
    rate: "",
    manualValue: "",
});

// ---------------- MONEY FORMAT ----------------

const money = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

// ---------------- SHOP DETAILS ----------------

const SHOP = {
    name: "PRANALI JEWELLERS",
    tagline: "GOLD | SILVER | ONE GRAM | CUSTOM JEWELLERY",
    address:
        "Grampanchayat Gala No.04, Main Road - mandai, Dighanchi, Maharashtra - 415315",
    phone: "+91 9421124579",
    by: "BY - Prakash Dixit(sir)",
    email: "pranalijewellers@gmail.com",
    footer: "Your Trust  •  Our Heritage  •  Timeless Jewellery",
};

// ---------------- AMOUNT IN WORDS ----------------

const amountInWords = (amount) => {
    const n = Math.round(Number(amount) || 0);

    if (!n) return "Zero Rupees Only";

    const a = [
        "",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ];

    const t = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ];

    const under1000 = (x) => {
        let out = "";

        if (x >= 100) {
            out += a[Math.floor(x / 100)] + " Hundred ";
            x %= 100;
        }

        if (x >= 20) {
            out += t[Math.floor(x / 10)] + " ";
            x %= 10;
        }

        if (x > 0) out += a[x] + " ";

        return out.trim();
    };

    let rest = n;
    let out = "";

    [
        [10000000, "Crore"],
        [100000, "Lakh"],
        [1000, "Thousand"],
        [1, ""],
    ].forEach(([v, label]) => {
        const part = Math.floor(rest / v);

        if (part) {
            out += under1000(part) + (label ? " " + label : "") + " ";
            rest %= v;
        }
    });

    return out.trim() + " Rupees Only";
};

// ---------------- PDF HELPERS ----------------

const pdfMoney = (v) =>
    new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(v) || 0);

const pdfDate = (v) =>
    v
        ? new Date(`${v}T00:00:00`).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : "";

// ============================================================
// NEW SH BILL COMPONENT
// ============================================================

export default function NewSHBill({ onNavigate }) {

    // ---------------- STATES ----------------

    const [billingType, setBillingType] = useState("GST");

    const [billDate, setBillDate] = useState(() => {
        const today = new Date();

        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    });

    const [customer, setCustomer] = useState({
        name: "",
        phone: "",
        address: "",
    });

    const [items, setItems] = useState([makeItem()]);
    const [exchangeItems, setExchangeItems] = useState([]);

    const [discount, setDiscount] = useState("0");
    const [paidAmount, setPaidAmount] = useState("0");

    const [notice, setNotice] = useState("");
    const [noticeType, setNoticeType] = useState("error");

    const [billNumber, setBillNumber] = useState(null);

    const [previewUrl, setPreviewUrl] = useState("");
    const [previewOpen, setPreviewOpen] = useState(false);

    const [savedBillNumber, setSavedBillNumber] = useState(null);

    const [isSaving, setIsSaving] = useState(false);

    // ---------------- WHATSAPP STATES ----------------

    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
    const [whatsAppPhone, setWhatsAppPhone] = useState("");

    // ---------------- REFS ----------------

    const savingRef = useRef(false);
    const sendingWhatsAppRef = useRef(false);

    const savedBillDataRef = useRef(null);
    const billNumberRef = useRef(null);
    const savedBillIdRef = useRef(null);

    const previewBlobRef = useRef(null);

    // ---------------- PREVIEW URL CLEANUP ----------------

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    // ============================================================
    // TOTAL CALCULATION
    // ============================================================

    const totals = useMemo(() => {
        const calculated = items.map((item) => {
            const weight = Math.max(0, Number(item.weight) || 0);
            const rate = Math.max(0, Number(item.rate) || 0);

            const makingCharges = Math.max(
                0,
                Number(item.makingCharges) || 0
            );

            const metalValue = weight * rate;

            return {
                ...item,
                weight,
                rate,
                makingCharges,
                metalValue,
                itemTotal: metalValue + makingCharges,
            };
        });

        const subtotal = calculated.reduce(
            (sum, item) => sum + item.itemTotal,
            0
        );

        const discountAmount = Math.min(
            subtotal,
            Math.max(0, Number(discount) || 0)
        );

        const taxableAmount = Math.max(
            0,
            subtotal - discountAmount
        );

        // Demonstration GST rate: 3%
        const gstAmount =
            billingType === "GST" ? taxableAmount * 0.03 : 0;

        return {
            items: calculated,
            subtotal,
            discountAmount,
            taxableAmount,
            gstAmount,
            grandTotal: taxableAmount + gstAmount,
        };
    }, [items, discount, billingType]);

    // ============================================================
    // EXCHANGE CALCULATION
    // ============================================================

    const calculatedExchangeItems = exchangeItems.map((item) => {
        const grossWeight = Number(item.grossWeight) || 0;
        const deductionWeight = Number(item.deductionWeight) || 0;

        const netWeight = Math.max(
            0,
            grossWeight - deductionWeight
        );

        const rate = Number(item.rate) || 0;

        const exchangeValue =
            item.metal === "Other"
                ? Math.max(0, Number(item.manualValue) || 0)
                : netWeight * rate;

        return {
            ...item,
            grossWeight,
            deductionWeight,
            netWeight,
            rate,
            exchangeValue,
        };
    });

    const exchangeTotal = calculatedExchangeItems.reduce(
        (sum, item) => sum + item.exchangeValue,
        0
    );

    const netPayable = Math.max(
        0,
        totals.grandTotal - exchangeTotal
    );

    const dueAmount = Math.max(
        0,
        netPayable - (Number(paidAmount) || 0)
    );

    // ============================================================
    // VALIDATION
    // ============================================================

    const validateForPdf = () => {
        if (!customer.name.trim()) {
            return "Please enter customer name.";
        }

        if (!/^[0-9]{10}$/.test(customer.phone)) {
            return "Please enter a valid 10-digit mobile number.";
        }

        if (!billDate) {
            return "Please select bill date.";
        }

        if (!items.length) {
            return "Please add at least one jewellery item.";
        }

        for (const item of totals.items) {
            if (!item.name.trim()) {
                return "Please enter all jewellery item names.";
            }

            if (item.weight <= 0 || item.rate <= 0) {
                return "Weight and rate must be greater than zero.";
            }
        }

        if (exchangeTotal > totals.grandTotal) {
            return "Exchange value cannot be greater than the bill grand total.";
        }

        for (const item of calculatedExchangeItems) {
            if (!item.description.trim()) {
                return "Please enter a description for every exchange item.";
            }

            if (item.metal === "Other") {
                if (item.exchangeValue <= 0) {
                    return "Please enter a valid exchange value for Other items.";
                }
            } else {
                if (
                    item.grossWeight <= 0 ||
                    item.rate <= 0 ||
                    item.deductionWeight < 0 ||
                    item.deductionWeight > item.grossWeight
                ) {
                    return "Check exchange gross weight, deduction weight and rate.";
                }
            }
        }

        const paid = Number(paidAmount);

        if (
            !Number.isFinite(paid) ||
            paid < 0 ||
            paid > netPayable
        ) {
            return "Paid amount must be between ₹0 and the net payable amount.";
        }

        if (totals.grandTotal <= 0) {
            return "Bill total must be greater than zero.";
        }

        return null;
    };

    // ============================================================
    // BUILD DATABASE OBJECT
    // ============================================================

    const buildBillData = () => ({
        billing_type:
            billingType === "GST" ? "GST" : "WITHOUT_GST",

        bill_date: billDate,

        customer_name: customer.name.trim(),
        customer_phone: customer.phone.trim(),
        customer_address: customer.address.trim(),

        items: totals.items,

        subtotal: Number(totals.subtotal.toFixed(2)),

        discount_amount: Number(
            totals.discountAmount.toFixed(2)
        ),

        gst_amount: Number(
            totals.gstAmount.toFixed(2)
        ),

        grand_total: Number(
            totals.grandTotal.toFixed(2)
        ),

        exchange_items: calculatedExchangeItems.map((item) => ({
            metal: item.metal,
            description: item.description,
            purity: item.purity,
            gross_weight: item.grossWeight,
            deduction_weight: item.deductionWeight,
            net_weight: item.netWeight,
            rate: item.rate,
            exchange_value: Number(item.exchangeValue.toFixed(2)),
        })),

        exchange_total: Number(exchangeTotal.toFixed(2)),

        net_payable: Number(netPayable.toFixed(2)),

        paid_amount: Number(paidAmount) || 0,

        due_amount: Number(dueAmount.toFixed(2)),
    });

    // ============================================================
    // SAVE BILL TO MYSQL
    // ============================================================

    const saveBillToDatabase = async () => {
        const validationError = validateForPdf();

        if (validationError) {
            setNotice(validationError);
            setNoticeType("error");
            return false;
        }

        const billData = buildBillData();
        const billDataSnapshot = JSON.stringify(billData);

        // Prevent duplicate insertion.
        if (
            savedBillNumber &&
            savedBillNumber === billNumber
        ) {
            if (savedBillDataRef.current !== billDataSnapshot) {
                setNotice(
                    "This bill is already saved. Do not change its details; create a new bill instead."
                );

                setNoticeType("error");
                return false;
            }

            return true;
        }

        if (savingRef.current) {
            return false;
        }

        savingRef.current = true;
        setIsSaving(true);

        setNotice("Saving bill to database...");
        setNoticeType("success");

        try {
            const response = await apiFetch("/sh-bills", {
                method: "POST",
                body: billDataSnapshot,
            });

            let result = {};

            try {
                result = await response.json();
            } catch {
                result = {};
            }

            if (!response.ok) {
                console.error("Backend response:", {
                    status: response.status,
                    data: result,
                });

                throw new Error(
                    result.message ||
                    `Bill saving failed (HTTP ${response.status}).`
                );
            }

            const generatedBillNumber = result.bill_number;
            const generatedBillId = result.bill_id;

            if (!generatedBillNumber || !generatedBillId) {
                throw new Error(
                    "Bill was saved, but the server did not return the bill ID or bill number."
                );
            }

            billNumberRef.current = generatedBillNumber;

            setBillNumber(generatedBillNumber);
            setSavedBillNumber(generatedBillNumber);

            savedBillIdRef.current = generatedBillId;

            // Store the exact saved bill data.
            // This prevents duplicate database insertion.
            savedBillDataRef.current = billDataSnapshot;

            setNotice(
                `Bill ${generatedBillNumber} saved successfully!`
            );

            setNoticeType("success");

            return true;

        } catch (error) {
            console.error("Save Bill Error:", error);

            setNotice(
                error.message ||
                "Unable to save bill. Check that the backend is running."
            );

            setNoticeType("error");

            return false;

        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    };

    // ============================================================
    // SAVE BILL BUTTON
    // ============================================================

    const saveBill = async () => {
        await saveBillToDatabase();
    };

    // ============================================================
    // NOTICE
    // ============================================================

    const clearNotice = () => {
        setNotice("");
    };

    // ============================================================
    // CUSTOMER UPDATE
    // ============================================================

    const updateCustomer = (field, value) => {
        setCustomer((old) => ({
            ...old,
            [field]: value,
        }));

        clearNotice();
    };

    // ============================================================
    // ITEM UPDATE
    // ============================================================

    const updateItem = (id, field, value) => {
        setItems((old) =>
            old.map((item) =>
                item.id === id
                    ? { ...item, [field]: value }
                    : item
            )
        );

        clearNotice();
    };

    // ============================================================
    // ADD ITEM
    // ============================================================

    const addItem = () => {
        setItems((old) => [...old, makeItem()]);
        clearNotice();
    };

    // ============================================================
    // REMOVE ITEM
    // ============================================================

    const removeItem = (id) => {
        setItems((old) =>
            old.length > 1
                ? old.filter((item) => item.id !== id)
                : old
        );

        clearNotice();
    };

    // ============================================================
    // EXCHANGE ITEM FUNCTIONS
    // ============================================================

    const addExchangeItem = () => {
        setExchangeItems((old) => [
            ...old,
            makeExchangeItem(),
        ]);

        clearNotice();
    };

    const updateExchangeItem = (id, field, value) => {
        setExchangeItems((old) =>
            old.map((item) =>
                item.id === id
                    ? { ...item, [field]: value }
                    : item
            )
        );

        clearNotice();
    };

    const removeExchangeItem = (id) => {
        setExchangeItems((old) =>
            old.filter((item) => item.id !== id)
        );

        clearNotice();
    };

    // ============================================================
    // CREATE PDF
    // ============================================================

    const createInvoicePDF = (billNumberOverride = billNumber) => {
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true,
        });

        const W = 210;
        const H = 297;
        const M = 10;
        const CW = W - 2 * M;

        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, W, H, "F");

        doc.setDrawColor(190, 145, 55);
        doc.setLineWidth(0.65);
        doc.rect(5, 5, W - 10, H - 10);

        doc.setLineWidth(0.2);
        doc.rect(7, 7, W - 14, H - 14);

        // SHOP HEADER

        doc.setFillColor(250, 245, 234);
        doc.rect(8, 8, W - 16, 37, "F");

        doc.addImage(
            pranaliLogo,
            "PNG",
            12,
            11,
            23,
            23,
            undefined,
            "FAST"
        );

        doc.addImage(
            bisHallmarkLogo,
            "PNG",
            175,
            13,
            23,
            16,
            undefined,
            "FAST"
        );

        doc.setTextColor(125, 83, 20);
        doc.setFont("times", "bold");
        doc.setFontSize(21);

        doc.text(SHOP.name, W / 2, 17, {
            align: "center",
            maxWidth: 132,
        });

        doc.setFont("times", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(60, 52, 40);

        doc.text(SHOP.tagline, W / 2, 22, {
            align: "center",
        });

        doc.text(SHOP.by, W / 2, 27, {
            align: "center",
        });

        doc.text(SHOP.address, W / 2, 32, {
            align: "center",
            maxWidth: CW - 8,
        });

        doc.text(
            `Phone: ${SHOP.phone}  |  Email: ${SHOP.email}`,
            W / 2,
            37,
            { align: "center" }
        );

        doc.setFont("times", "bold");
        doc.setFontSize(13);
        doc.setTextColor(125, 83, 20);

        doc.text("SALES INVOICE", W / 2, 43, {
            align: "center",
        });

        // CUSTOMER AND INVOICE DETAILS

        const leftX = M;
        const gap = 4;
        const leftW = 112;
        const rightX = leftX + leftW + gap;
        const rightW = CW - leftW - gap;

        const panelY = 49;
        const panelH = 31;

        doc.setDrawColor(205, 183, 139);
        doc.setLineWidth(0.25);

        doc.roundedRect(
            leftX,
            panelY,
            leftW,
            panelH,
            1.5,
            1.5
        );

        doc.roundedRect(
            rightX,
            panelY,
            rightW,
            panelH,
            1.5,
            1.5
        );

        doc.setFillColor(244, 234, 212);

        doc.rect(leftX, panelY, leftW, 6, "F");
        doc.rect(rightX, panelY, rightW, 6, "F");

        doc.setTextColor(60, 45, 23);
        doc.setFont("times", "bold");
        doc.setFontSize(7.5);

        doc.text(
            "CUSTOMER DETAILS",
            leftX + 3,
            panelY + 4.2
        );

        doc.text(
            "INVOICE DETAILS",
            rightX + 3,
            panelY + 4.2
        );

        doc.setFont("times", "normal");
        doc.setFontSize(7.3);

        const address = customer.address?.trim()
            ? customer.address.trim()
            : "-";

        doc.text(
            doc
                .splitTextToSize(
                    `Name: ${customer.name}`,
                    leftW - 6
                )
                .slice(0, 1),
            leftX + 3,
            panelY + 12
        );

        doc.text(
            `Mobile: ${customer.phone}`,
            leftX + 3,
            panelY + 18
        );

        doc.text(
            doc
                .splitTextToSize(
                    `Address: ${address}`,
                    leftW - 6
                )
                .slice(0, 1),
            leftX + 3,
            panelY + 24
        );

        doc.text(
            doc.splitTextToSize(
                `Bill No: ${billNumberOverride || "DRAFT"}`,
                rightW - 6
            ),
            rightX + 3,
            panelY + 12
        );

        doc.text(
            doc.splitTextToSize(
                `Date: ${pdfDate(billDate)}`,
                rightW - 6
            ),
            rightX + 3,
            panelY + 18
        );

        // GST NUMBER

        if (billingType === "GST") {
            doc.setFont("times", "bold");
            doc.setFontSize(7.3);
            doc.setTextColor(125, 83, 20);

            doc.text(
                "GST No: 27APEPD6553J2ZR",
                rightX + 3,
                panelY + 25
            );

            doc.setFont("times", "normal");
            doc.setTextColor(60, 52, 40);
        }

        // NEW JEWELLERY HEADING

        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(125, 83, 20);

        doc.text(
            "NEW GOLD / SILVER / OTHER DETAILS",
            M,
            84
        );

        // JEWELLERY TABLE

        const count = totals.items.length;

        const tableFont =
            count > 10 ? 5.2 : count > 6 ? 6 : 6.6;

        autoTable(doc, {
            startY: 88,

            margin: {
                left: M,
                right: M,
                bottom: 62,
            },

            theme: "grid",

            pageBreak: "avoid",

            head: [
                [
                    "Sr.",
                    "Jewellery Description",
                    "Metal / Purity",
                    "Wt. (g)",
                    "Rate per g ",
                    "Metal ",
                    "Making ",
                    "Total ",
                ],
            ],

            body: totals.items.map((it, i) => [
                String(i + 1),
                it.name,
                `${it.metal} / ${it.purity}`,
                Number(it.weight).toFixed(3),
                pdfMoney(it.rate),
                pdfMoney(it.metalValue),
                pdfMoney(it.makingCharges),
                pdfMoney(it.itemTotal),
            ]),

            styles: {
                font: "times",
                fontSize: tableFont,
                cellPadding: count > 8 ? 1.1 : 1.7,
                textColor: [40, 40, 40],
                lineColor: [220, 205, 177],
                lineWidth: 0.2,
                overflow: "linebreak",
                valign: "middle",
            },

            headStyles: {
                fillColor: [125, 83, 20],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                halign: "center",
            },

            columnStyles: {
                0: { cellWidth: 8, halign: "center" },
                1: { cellWidth: 39 },
                2: { cellWidth: 26 },
                3: { cellWidth: 16, halign: "right" },
                4: { cellWidth: 23, halign: "right" },
                5: { cellWidth: 25, halign: "right" },
                6: { cellWidth: 23, halign: "right" },
                7: { cellWidth: 30, halign: "right" },
            },

            tableWidth: "auto",
        });

        // EXCHANGE DETAILS IN PDF

        if (calculatedExchangeItems.length > 0) {
            const exchangeStartY =
                (doc.lastAutoTable?.finalY || 100) + 7;

            doc.setFont("times", "bold");
            doc.setFontSize(9);
            doc.setTextColor(125, 83, 20);

            doc.text(
                " OLD GOLD / SILVER / OTHER EXCHANGE DETAILS",
                M,
                exchangeStartY
            );

            autoTable(doc, {
                startY: exchangeStartY + 3,

                margin: {
                    left: M,
                    right: M,
                    bottom: 62,
                },

                theme: "grid",

                head: [[
                    "Sr.",
                    "Type",
                    "Description",
                    "Purity",
                    "Gross Wt.",
                    "Deduction",
                    "Net Wt.",
                    "Rate/g",
                    "Exchange Value",
                ]],

                body: calculatedExchangeItems.map((item, index) => [
                    index + 1,
                    item.metal,
                    item.description || "-",
                    item.metal === "Other" ? "-" : item.purity,

                    item.metal === "Other"
                        ? "-"
                        : `${item.grossWeight.toFixed(3)} g`,

                    item.metal === "Other"
                        ? "-"
                        : `${item.deductionWeight.toFixed(3)} g`,

                    item.metal === "Other"
                        ? "-"
                        : `${item.netWeight.toFixed(3)} g`,

                    item.metal === "Other"
                        ? "-"
                        : pdfMoney(item.rate),

                    pdfMoney(item.exchangeValue),
                ]),

                styles: {
                    font: "times",
                    fontSize: 6.5,
                    cellPadding: 1.8,
                    textColor: [40, 40, 40],
                    lineColor: [220, 205, 177],
                    lineWidth: 0.2,
                    overflow: "linebreak",
                    valign: "middle",
                },

                headStyles: {
                    fillColor: [125, 83, 20],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    halign: "center",
                },

                columnStyles: {
                    0: { cellWidth: 8, halign: "center" },
                    1: { cellWidth: 15 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 15 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 20 },
                    6: { cellWidth: 20 },
                    7: { cellWidth: 20 },
                    8: { cellWidth: 27, halign: "right" },
                },

                tableWidth: "auto",
            });

            const exchangeEndY = doc.lastAutoTable.finalY + 4;

            doc.setFont("times", "bold");
            doc.setFontSize(8);
            doc.setTextColor(125, 83, 20);

            doc.text(
                `TOTAL EXCHANGE VALUE: Rs. ${pdfMoney(exchangeTotal)}`,
                W - M,
                exchangeEndY,
                { align: "right" }
            );
        }

        // TOTALS

        const totalsY = (doc.lastAutoTable?.finalY || 100) + 8;

        const rowH = 6;
        const paid = Number(paidAmount) || 0;

        const rows = [
            ["Subtotal", totals.subtotal],
            ["Discount", totals.discountAmount],

            ...(billingType === "GST"
                ? [["GST (3% demo)", totals.gstAmount]]
                : []),

            ["GRAND TOTAL", totals.grandTotal],

            ...(exchangeTotal > 0
                ? [["LESS: EXCHANGE VALUE", exchangeTotal]]
                : []),

            ...(exchangeTotal > 0
                ? [["NET PAYABLE", netPayable]]
                : []),

            ["PAID AMOUNT", paid],
            ["DUE AMOUNT", dueAmount],
        ];

        rows.forEach(([label, value], i) => {
            const rowY = totalsY + i * rowH;

            if (
                label === "GRAND TOTAL" ||
                label === "NET PAYABLE"
            ) {
                doc.setFillColor(125, 83, 20);

                doc.roundedRect(
                    M,
                    rowY,
                    CW,
                    rowH,
                    1,
                    1,
                    "F"
                );

                doc.setTextColor(255, 255, 255);
                doc.setFont("times", "bold");

            } else {
                doc.setTextColor(45, 45, 45);
                doc.setFont("times", "normal");

                doc.setDrawColor(230, 218, 196);

                doc.line(
                    M,
                    rowY + rowH,
                    W - M,
                    rowY + rowH
                );
            }

            doc.setFontSize(
                label === "GRAND TOTAL" || label === "NET PAYABLE"
                    ? 8.5
                    : 7.5
            );

            doc.text(label, M + 3, rowY + 4);

            doc.text(
                `Rs. ${pdfMoney(value)}`,
                W - M - 5,
                rowY + 4,
                {
                    align: "right",
                    maxWidth: 78,
                }
            );
        });

        // AMOUNT IN WORDS

        const amountWordsY = totalsY + rows.length * rowH + 7;

        doc.setDrawColor(205, 183, 139);
        doc.setFillColor(250, 245, 234);

        doc.roundedRect(
            M,
            amountWordsY,
            CW,
            18,
            1.5,
            1.5,
            "FD"
        );

        doc.setFont("times", "bold");
        doc.setFontSize(8);
        doc.setTextColor(125, 83, 20);

        doc.text(
            "TOTAL AMOUNT IN WORDS",
            M + 3,
            amountWordsY + 5
        );

        doc.setFont("times", "normal");
        doc.setFontSize(8);
        doc.setTextColor(40, 40, 40);

        doc.text(
            amountInWords(netPayable),
            M + 3,
            amountWordsY + 12,
            {
                maxWidth: CW - 6,
            }
        );

        // FOOTER

        const footerY = Math.max(264, amountWordsY + 27);

        doc.setDrawColor(190, 145, 55);

        doc.line(
            M,
            footerY - 4,
            W - M,
            footerY - 4
        );

        doc.setFont("times", "bold");
        doc.setFontSize(7.2);
        doc.setTextColor(75, 55, 25);

        doc.text(
            "TERMS & CONDITIONS",
            M,
            footerY + 1
        );

        doc.setFont("times", "normal");
        doc.setFontSize(6.3);
        doc.setTextColor(55, 55, 55);

        const terms = [
            "1. Goods once sold will not be taken back or exchanged.",
            "2. Purity as per applicable hallmark details.",
            "3. Thank you for shopping with us.",
        ];

        doc.text(
            doc
                .splitTextToSize(terms.join("\n"), 112)
                .slice(0, 6),
            M,
            footerY + 6,
            {
                lineHeightFactor: 1.3,
            }
        );

        doc.setDrawColor(90, 90, 90);
        doc.line(139, footerY + 8, 195, footerY + 8);

        doc.setFontSize(7);

        doc.text(
            "Authorised Signatory",
            167,
            footerY + 12,
            { align: "center" }
        );

        doc.setFont("times", "bold");

        doc.text(
            "PRANALI JEWELLERS",
            167,
            footerY + 17,
            { align: "center" }
        );

        doc.setFont("times", "bold");

        doc.text(
            "Customer Signature",
            105,
            footerY + 12,
            { align: "center" }
        );

        doc.setFillColor(125, 83, 20);
        doc.rect(8, H - 13, W - 16, 5, "F");

        doc.setFont("times", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);

        doc.text(
            SHOP.footer,
            W / 2,
            H - 9.5,
            { align: "center" }
        );

        // Keep the invoice to one page.
        while (doc.getNumberOfPages() > 1) {
            doc.deletePage(doc.getNumberOfPages());
        }

        return doc;
    };

    // ============================================================
    // PREVIEW PDF
    // ============================================================

    const previewPDF = () => {
        const error = validateForPdf();

        if (error) {
            setNotice(error);
            setNoticeType("error");
            return;
        }

        const pdfBlob = createInvoicePDF(
            billNumberRef.current || billNumber
        ).output("blob");

        previewBlobRef.current = pdfBlob;

        const url = URL.createObjectURL(pdfBlob);

        setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old);
            return url;
        });

        setPreviewOpen(true);

        setNotice("PDF preview ready.");
        setNoticeType("success");
    };

    // ============================================================
    // DOWNLOAD PDF
    // ============================================================

    const downloadPDF = async () => {
        const isSaved = await saveBillToDatabase();

        if (!isSaved) {
            return;
        }

        const generatedBillNumber = billNumberRef.current;

        if (!generatedBillNumber) {
            setNotice("Bill number was not returned by the server.");
            setNoticeType("error");
            return;
        }

        const pdfBlob = createInvoicePDF(
            generatedBillNumber
        ).output("blob");

        previewBlobRef.current = pdfBlob;

        createInvoicePDF(generatedBillNumber).save(
            `Pranali-Jewellers-${generatedBillNumber}.pdf`
        );

        setNotice(
            `Bill ${generatedBillNumber} saved successfully! PDF downloaded.`
        );

        setNoticeType("success");
    };

    // ============================================================
    // WHATSAPP BILL PDF
    // ============================================================

    // Normalize Indian mobile number.
    // Accepts 10 digits or 91 followed by 10 digits.

    const normalizeWhatsAppPhone = (value) => {
        const digits = String(value || "").replace(/\D/g, "");

        if (/^[6-9]\d{9}$/.test(digits)) {
            return `91${digits}`;
        }

        if (/^91[6-9]\d{9}$/.test(digits)) {
            return digits;
        }

        return null;
    };

    // Open recipient confirmation modal.

    const openWhatsAppConfirmation = () => {
        const phone = normalizeWhatsAppPhone(customer.phone);

        if (!phone) {
            setNotice(
                "Please enter a valid 10-digit mobile number."
            );

            setNoticeType("error");
            return;
        }

        setWhatsAppPhone(phone.slice(2));

        setWhatsAppModalOpen(true);

        clearNotice();
    };

    // Send bill PDF through WhatsApp.

    const sendBillOnWhatsApp = async () => {
        if (sendingWhatsAppRef.current) {
            return;
        }

        const recipientPhone = normalizeWhatsAppPhone(
            whatsAppPhone
        );

        if (!recipientPhone) {
            setNotice(
                "Please enter a valid 10-digit WhatsApp mobile number."
            );

            setNoticeType("error");
            return;
        }

        sendingWhatsAppRef.current = true;
        setIsSendingWhatsApp(true);

        try {
            // STEP 1: Save the bill first.

            const isSaved = await saveBillToDatabase();

            if (!isSaved) {
                return;
            }

            // STEP 2: Get saved bill ID and number.

            const billId = savedBillIdRef.current;
            const generatedBillNumber = billNumberRef.current;

            if (!billId || !generatedBillNumber) {
                throw new Error(
                    "Saved bill ID or bill number is missing."
                );
            }

            // STEP 3: Generate final invoice PDF.
            // This uses the same PDF generator as Preview PDF.

            const pdfBlob = createInvoicePDF(
                generatedBillNumber
            ).output("blob");

            previewBlobRef.current = pdfBlob;

            // STEP 4: Update preview with the final saved invoice.

            const previewObjectUrl = URL.createObjectURL(pdfBlob);

            setPreviewUrl((old) => {
                if (old) URL.revokeObjectURL(old);
                return previewObjectUrl;
            });

            // STEP 5: Prepare multipart request.

            const formData = new FormData();

            formData.append(
                "pdf",
                pdfBlob,
                `Pranali-Jewellers-${generatedBillNumber}.pdf`
            );

            formData.append(
                "billId",
                String(billId)
            );

            formData.append(
                "recipientPhone",
                recipientPhone
            );

            // STEP 6: Send to backend.

            const response = await apiFetch(
                "/whatsapp/send-bill-pdf",
                {
                    method: "POST",
                    body: formData,
                }
            );

            let result = {};

            try {
                result = await response.json();
            } catch {
                result = {};
            }

            if (!response.ok) {
                throw new Error(
                    result.message ||
                    "Unable to send bill PDF on WhatsApp."
                );
            }

            // STEP 7: Success.

            setWhatsAppModalOpen(false);

            setNotice(
                `Bill ${generatedBillNumber} sent successfully on WhatsApp to +${recipientPhone}.`
            );

            setNoticeType("success");

        } catch (error) {
            console.error(
                "WhatsApp Bill PDF Error:",
                error
            );

            setNotice(
                error.message ||
                "Unable to send bill PDF on WhatsApp."
            );

            setNoticeType("error");

        } finally {
            sendingWhatsAppRef.current = false;
            setIsSendingWhatsApp(false);
        }
    };

    // ============================================================
    // UI
    // ============================================================

    return (
        <div className="shbill-container">

            <span className="gi-eyebrow">
                PRANALI JEWELLERS
            </span>

            <h2>
                <em>Create New Customer Bill</em>
            </h2>

            <form
                className="shbill-layout"
                onSubmit={(event) => event.preventDefault()}
                noValidate
            >

                <div className="shbill-main-column">

                    {/* BILL INFORMATION */}

                    <section className="shbill-card">

                        <div className="shbill-section-heading">

                            <span className="shbill-section-icon">
                                01
                            </span>

                            <div className="shbill-section-copy">
                                <h2>Bill information</h2>
                                <p>
                                    Choose the invoice type and date.
                                </p>
                            </div>

                        </div>

                        <p className="shbill-type-label">
                            Billing type
                        </p>

                        <div className="shbill-type-options">

                            <button
                                type="button"
                                className={`shbill-type-option ${billingType === "GST" ? "selected" : ""}`}
                                onClick={() => {
                                    setBillingType("GST");
                                    clearNotice();
                                }}
                                aria-pressed={billingType === "GST"}
                            >

                                <span className="shbill-type-symbol">
                                    %
                                </span>

                                <span className="shbill-type-copy">
                                    <strong>With GST</strong>
                                    <small>
                                        3% demonstration GST is included.
                                    </small>
                                </span>

                                <span
                                    className="shbill-radio"
                                    aria-hidden="true"
                                >
                                    {billingType === "GST" ? "✓" : ""}
                                </span>

                            </button>

                            <button
                                type="button"
                                className={`shbill-type-option ${billingType === "NON_GST" ? "selected" : ""}`}
                                onClick={() => {
                                    setBillingType("NON_GST");
                                    clearNotice();
                                }}
                                aria-pressed={billingType === "NON_GST"}
                            >

                                <span className="shbill-type-symbol">
                                    ₹
                                </span>

                                <span className="shbill-type-copy">
                                    <strong>Without GST</strong>
                                    <small>
                                        No GST is added to the total.
                                    </small>
                                </span>

                                <span
                                    className="shbill-radio"
                                    aria-hidden="true"
                                >
                                    {billingType === "NON_GST" ? "✓" : ""}
                                </span>

                            </button>

                        </div>

                        <label className="shbill-field shbill-date-field">

                            <span>
                                Bill date <b>*</b>
                            </span>

                            <input
                                type="date"
                                value={billDate}
                                onChange={(event) => {
                                    setBillDate(event.target.value);
                                    clearNotice();
                                }}
                                required
                            />

                        </label>

                    </section>

                    {/* CUSTOMER DETAILS */}

                    <section className="shbill-card">

                        <div className="shbill-section-heading">

                            <span className="shbill-section-icon">
                                02
                            </span>

                            <div className="shbill-section-copy">
                                <h2>Customer details</h2>
                                <p>
                                    Enter the customer information for this invoice.
                                </p>
                            </div>

                        </div>

                        <div className="shbill-fields-grid">

                            <label className="shbill-field">

                                <span>
                                    Customer name <b>*</b>
                                </span>

                                <input
                                    value={customer.name}
                                    onChange={(event) =>
                                        updateCustomer(
                                            "name",
                                            event.target.value
                                        )
                                    }
                                    placeholder="e.g. Priya Patil"
                                    autoComplete="name"
                                    required
                                />

                            </label>

                            <label className="shbill-field">

                                <span>
                                    Mobile number <b>*</b>
                                </span>

                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={customer.phone}
                                    onChange={(event) =>
                                        updateCustomer(
                                            "phone",
                                            event.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 10)
                                        )
                                    }
                                    placeholder="Enter 10-digit number"
                                    autoComplete="tel"
                                    required
                                />

                                <small>
                                    Enter a 10-digit mobile number.
                                </small>

                            </label>

                            <label className="shbill-field shbill-full">

                                <span>
                                    Address <em>Optional</em>
                                </span>

                                <textarea
                                    rows={2}
                                    value={customer.address}
                                    onChange={(event) =>
                                        updateCustomer(
                                            "address",
                                            event.target.value
                                        )
                                    }
                                    placeholder="Area, city, PIN code"
                                />

                            </label>

                        </div>

                    </section>

                    {/* NEW JEWELLERY ITEMS */}

                    <section className="shbill-card">

                        <div className="shbill-section-heading shbill-action-heading shbill-jewellery-heading">

                            <span className="shbill-section-icon">
                                03
                            </span>

                            <div className="shbill-section-copy">
                                <h2>Jewellery items</h2>
                                <p>
                                    Choose the metal and purity, then enter the weight and rates.
                                </p>
                            </div>

                            <button
                                className="shbill-add-button"
                                type="button"
                                onClick={addItem}
                            >
                                + Add item
                            </button>

                        </div>

                        {items.map((item, index) => (

                            <article
                                className="shbill-item-card"
                                key={item.id}
                            >

                                <div className="shbill-item-title">

                                    <span className="shbill-item-number">
                                        {String(index + 1).padStart(2, "0")}
                                    </span>

                                    <div className="shbill-item-copy">
                                        <h3>
                                            {item.name.trim() ||
                                                `Jewellery item ${index + 1}`}
                                        </h3>

                                        <p>
                                            Item details and price calculation
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="shbill-remove-button"
                                        onClick={() => removeItem(item.id)}
                                        disabled={items.length === 1}
                                        aria-label={`Remove jewellery item ${index + 1}`}
                                    >
                                        Remove
                                    </button>

                                </div>

                                <div className="shbill-fields-grid shbill-item-fields">

                                    <label className="shbill-field shbill-full">

                                        <span>
                                            Item name <b>*</b>
                                        </span>

                                        <input
                                            value={item.name}
                                            onChange={(event) =>
                                                updateItem(
                                                    item.id,
                                                    "name",
                                                    event.target.value
                                                )
                                            }
                                            placeholder="e.g. Gold ring, necklace, bangles"
                                            required
                                        />

                                    </label>

                                    <label className="shbill-field">

                                        <span>
                                            Metal type <b>*</b>
                                        </span>

                                        <select
                                            value={item.metal}
                                            onChange={(event) =>
                                                updateItem(
                                                    item.id,
                                                    "metal",
                                                    event.target.value
                                                )
                                            }
                                        >
                                            <option>Gold</option>
                                            <option>Silver</option>
                                            <option>Other</option>
                                        </select>

                                    </label>

                                    {item.metal === "Gold" ? (

                                        <label className="shbill-field">

                                            <span>
                                                Purity / Karat <b>*</b>
                                            </span>

                                            <select
                                                value={item.purity}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "purity",
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option value="24K">24K</option>
                                                <option value="22K">22K</option>
                                                <option value="20K">20K</option>
                                                <option value="18K">18K</option>
                                                <option value="14K">14K</option>
                                                <option value="9K">9K</option>
                                            </select>

                                        </label>

                                    ) : (

                                        <label className="shbill-field">

                                            <span>
                                                Purity (%) <b>*</b>
                                            </span>

                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={item.purity}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "purity",
                                                        event.target.value.replace(/[^0-9.]/g, "")
                                                    )
                                                }
                                                placeholder="e.g. 92.5"
                                            />

                                        </label>

                                    )}

                                    <label className="shbill-field">

                                        <span>
                                            Weight (g) <b>*</b>
                                        </span>

                                        <div className="shbill-input-unit">

                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={item.weight}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "weight",
                                                        event.target.value.replace(/[^0-9.]/g, "")
                                                    )
                                                }
                                                placeholder="Enter weight"
                                                required
                                            />

                                            <span>g</span>

                                        </div>

                                    </label>

                                    <label className="shbill-field">

                                        <span>
                                            Rate per gram (₹) <b>*</b>
                                        </span>

                                        <div className="shbill-input-unit">

                                            <span>₹</span>

                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={item.rate}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "rate",
                                                        event.target.value.replace(/[^0-9.]/g, "")
                                                    )
                                                }
                                                placeholder="0.00"
                                                required
                                            />

                                        </div>

                                    </label>

                                    <label className="shbill-field">

                                        <span>
                                            Making charges (₹)
                                        </span>

                                        <div className="shbill-input-unit">

                                            <span>₹</span>

                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={item.makingCharges}
                                                onChange={(event) =>
                                                    updateItem(
                                                        item.id,
                                                        "makingCharges",
                                                        event.target.value.replace(/[^0-9.]/g, "")
                                                    )
                                                }
                                                placeholder="0.00"
                                            />

                                        </div>

                                    </label>

                                    <div className="shbill-item-total">

                                        <span>Item total</span>

                                        <strong>
                                            {money(
                                                totals.items[index]?.itemTotal || 0
                                            )}
                                        </strong>

                                    </div>

                                </div>

                            </article>

                        ))}

                        <button
                            className="shbill-add-another"
                            type="button"
                            onClick={addItem}
                        >

                            <span className="shbill-add-another-icon">
                                +
                            </span>

                            <span>
                                <strong>
                                    Add another jewellery item
                                </strong>

                                <small>
                                    Use this when the customer is buying more than one item.
                                </small>
                            </span>

                        </button>

                    </section>

                    {/* OLD GOLD / SILVER / OTHER EXCHANGE */}

                    <section className="shbill-card shbill-exchange-section">

                        <div className="shbill-section-heading shbill-action-heading shbill-exchange-heading">

                            <span className="shbill-section-icon">
                                04
                            </span>

                            <div className="shbill-section-copy shbill-exchange-heading-copy">
                                <h2>
                                    Gold / Silver / Other Exchange
                                </h2>

                                <p>
                                    Add old jewellery or other items received from the customer.
                                </p>
                            </div>

                            <button
                                className="shbill-add-button"
                                type="button"
                                onClick={addExchangeItem}
                            >
                                + Add Exchange Item
                            </button>

                        </div>

                        {calculatedExchangeItems.length === 0 ? (

                            <div className="shbill-exchange-empty">
                                <strong>
                                    No exchange items added.
                                </strong>

                                <span>
                                    Add an item when the customer exchanges old jewellery.
                                </span>
                            </div>

                        ) : (

                            calculatedExchangeItems.map((item, index) => (

                                <article
                                    className="shbill-item-card"
                                    key={item.id}
                                >

                                    <div className="shbill-item-title">

                                        <span className="shbill-item-number">
                                            {String(index + 1).padStart(2, "0")}
                                        </span>

                                        <div className="shbill-item-copy">
                                            <h3>
                                                {item.description.trim() ||
                                                    `Exchange item ${index + 1}`}
                                            </h3>

                                            <p>
                                                Details of the item received from the customer
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            className="shbill-remove-button"
                                            onClick={() =>
                                                removeExchangeItem(item.id)
                                            }
                                            aria-label={`Remove exchange item ${index + 1}`}
                                        >
                                            Remove
                                        </button>

                                    </div>

                                    <div className="shbill-fields-grid shbill-item-fields">

                                        <label className="shbill-field">

                                            <span>
                                                Exchange type <b>*</b>
                                            </span>

                                            <select
                                                value={item.metal}
                                                onChange={(event) =>
                                                    updateExchangeItem(
                                                        item.id,
                                                        "metal",
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                <option>Gold</option>
                                                <option>Silver</option>
                                                <option>Other</option>
                                            </select>

                                        </label>

                                        <label className="shbill-field">

                                            <span>
                                                Description <b>*</b>
                                            </span>

                                            <input
                                                value={item.description}
                                                onChange={(event) =>
                                                    updateExchangeItem(
                                                        item.id,
                                                        "description",
                                                        event.target.value
                                                    )
                                                }
                                                placeholder="e.g. Old gold chain"
                                            />

                                        </label>

                                        {item.metal === "Gold" ? (

                                            <label className="shbill-field">

                                                <span>
                                                    Purity / Karat <b>*</b>
                                                </span>

                                                <select
                                                    value={item.purity}
                                                    onChange={(event) =>
                                                        updateExchangeItem(
                                                            item.id,
                                                            "purity",
                                                            event.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="24K">24K</option>
                                                    <option value="22K">22K</option>
                                                    <option value="20K">20K</option>
                                                    <option value="18K">18K</option>
                                                    <option value="14K">14K</option>
                                                    <option value="9K">9K</option>
                                                </select>

                                            </label>

                                        ) : item.metal === "Silver" ? (

                                            <label className="shbill-field">

                                                <span>
                                                    Purity (%)
                                                </span>

                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={item.purity}
                                                    onChange={(event) =>
                                                        updateExchangeItem(
                                                            item.id,
                                                            "purity",
                                                            event.target.value.replace(/[^0-9.]/g, "")
                                                        )
                                                    }
                                                    placeholder="e.g. 92.5"
                                                />

                                            </label>

                                        ) : null}

                                        {item.metal === "Other" ? (

                                            <label className="shbill-field">

                                                <span>
                                                    Exchange value (₹) <b>*</b>
                                                </span>

                                                <div className="shbill-input-unit">

                                                    <span>₹</span>

                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={item.manualValue}
                                                        onChange={(event) =>
                                                            updateExchangeItem(
                                                                item.id,
                                                                "manualValue",
                                                                event.target.value.replace(/[^0-9.]/g, "")
                                                            )
                                                        }
                                                        placeholder="0.00"
                                                    />

                                                </div>

                                            </label>

                                        ) : (

                                            <>

                                                <label className="shbill-field">

                                                    <span>
                                                        Gross weight (g) <b>*</b>
                                                    </span>

                                                    <div className="shbill-input-unit">

                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={item.grossWeight}
                                                            onChange={(event) =>
                                                                updateExchangeItem(
                                                                    item.id,
                                                                    "grossWeight",
                                                                    event.target.value.replace(/[^0-9.]/g, "")
                                                                )
                                                            }
                                                            placeholder="0.000"
                                                        />

                                                        <span>g</span>

                                                    </div>

                                                </label>

                                                <label className="shbill-field">

                                                    <span>
                                                        Deduction weight (g)
                                                    </span>

                                                    <div className="shbill-input-unit">

                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={item.deductionWeight}
                                                            onChange={(event) =>
                                                                updateExchangeItem(
                                                                    item.id,
                                                                    "deductionWeight",
                                                                    event.target.value.replace(/[^0-9.]/g, "")
                                                                )
                                                            }
                                                            placeholder="0.000"
                                                        />

                                                        <span>g</span>

                                                    </div>

                                                </label>

                                                <label className="shbill-field">

                                                    <span>
                                                        Net weight (g)
                                                    </span>

                                                    <input
                                                        value={item.netWeight.toFixed(3)}
                                                        readOnly
                                                    />

                                                </label>

                                                <label className="shbill-field">

                                                    <span>
                                                        Rate per gram (₹) <b>*</b>
                                                    </span>

                                                    <div className="shbill-input-unit">

                                                        <span>₹</span>

                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={item.rate}
                                                            onChange={(event) =>
                                                                updateExchangeItem(
                                                                    item.id,
                                                                    "rate",
                                                                    event.target.value.replace(/[^0-9.]/g, "")
                                                                )
                                                            }
                                                            placeholder="0.00"
                                                        />

                                                    </div>

                                                </label>

                                            </>

                                        )}

                                        <div className="shbill-exchange-value">

                                            <span>
                                                Calculated exchange value
                                            </span>

                                            <strong>
                                                {money(item.exchangeValue)}
                                            </strong>

                                        </div>

                                    </div>

                                </article>

                            ))

                        )}

                        {exchangeTotal > 0 && (

                            <div className="shbill-exchange-total">

                                <span>
                                    Total exchange value
                                </span>

                                <strong>
                                    {money(exchangeTotal)}
                                </strong>

                            </div>

                        )}

                    </section>

                </div>

                {/* BILL SUMMARY */}

                <BillSummary
                    money={money}
                    netPayable={netPayable}
                    items={items}
                    totals={totals}
                    discount={discount}
                    setDiscount={setDiscount}
                    clearNotice={clearNotice}
                    billingType={billingType}
                    exchangeTotal={exchangeTotal}
                    paidAmount={paidAmount}
                    setPaidAmount={setPaidAmount}
                    dueAmount={dueAmount}
                    notice={notice}
                    noticeType={noticeType}
                    previewPDF={previewPDF}
                    downloadPDF={downloadPDF}
                    isSaving={isSaving}
                    onSendWhatsApp={openWhatsAppConfirmation}
                    isSendingWhatsApp={isSendingWhatsApp}
                />

            </form>

            <BillFooter tagline={SHOP.footer} />

            {/* ================================================== */}
            {/* PDF PREVIEW MODAL */}
            {/* ================================================== */}

            {previewOpen && (

                <div
                    className="shbill-preview-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Invoice PDF preview"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setPreviewOpen(false);
                        }
                    }}
                >

                    <section className="shbill-preview-modal">

                        <header className="shbill-preview-header">

                            <div>
                                <strong>
                                    Invoice preview
                                </strong>

                                <small>
                                    Bill {billNumber || "DRAFT"} · A4 portrait · one page
                                </small>
                            </div>

                            <button
                                type="button"
                                onClick={() => setPreviewOpen(false)}
                                aria-label="Close preview"
                            >
                                ×
                            </button>

                        </header>

                        <iframe
                            title="Pranali Jewellers invoice preview"
                            src={previewUrl}
                        />

                        <footer className="shbill-preview-actions">

                            <button
                                type="button"
                                className="shbill-secondary-button"
                                onClick={() => setPreviewOpen(false)}
                            >
                                Close
                            </button>

                            <button
                                type="button"
                                className="shbill-primary-button"
                                onClick={downloadPDF}
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : "Save & download"}
                            </button>

                            <button
                                type="button"
                                className="shbill-primary-button"
                                onClick={() => {
                                    const printWindow = window.open(
                                        previewUrl,
                                        "_blank"
                                    );

                                    if (!printWindow) {
                                        setNotice(
                                            "Allow pop-ups to open the PDF for printing."
                                        );

                                        setNoticeType("error");
                                    }
                                }}
                            >
                                Open to print
                            </button>

                        </footer>

                    </section>

                </div>

            )}

            {/* ================================================== */}
            {/* WHATSAPP CONFIRMATION MODAL */}
            {/* ================================================== */}

            {whatsAppModalOpen && (

                <div
                    className="shbill-preview-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="WhatsApp mobile number confirmation"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !isSendingWhatsApp
                        ) {
                            setWhatsAppModalOpen(false);
                        }
                    }}
                >

                    <section className="shbill-preview-modal shbill-whatsapp-modal">

                        <header className="shbill-preview-header">

                            <div>
                                <strong>
                                    Send Bill on WhatsApp
                                </strong>

                                <small>
                                    Confirm the recipient mobile number.
                                </small>
                            </div>

                            <button
                                type="button"
                                onClick={() => setWhatsAppModalOpen(false)}
                                disabled={isSendingWhatsApp}
                                aria-label="Close"
                            >
                                ×
                            </button>

                        </header>

                        <div className="shbill-whatsapp-content">

                            <p>
                                The invoice PDF will be sent to this WhatsApp number.
                                Please verify the number before sending.
                            </p>

                            <label className="shbill-field">

                                <span>
                                    WhatsApp mobile number <b>*</b>
                                </span>

                                <div className="shbill-input-unit">

                                    <span>+91</span>

                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={10}
                                        value={whatsAppPhone}
                                        onChange={(event) => {
                                            setWhatsAppPhone(
                                                event.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 10)
                                            );
                                        }}
                                        placeholder="Enter 10-digit number"
                                        disabled={isSendingWhatsApp}
                                    />

                                </div>

                            </label>

                            <small>
                                You can correct the number if the customer's
                                WhatsApp number is different from the registered
                                mobile number.
                            </small>

                        </div>

                        <footer className="shbill-preview-actions">

                            <button
                                type="button"
                                className="shbill-secondary-button"
                                onClick={() => setWhatsAppModalOpen(false)}
                                disabled={isSendingWhatsApp}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="shbill-primary-button"
                                onClick={sendBillOnWhatsApp}
                                disabled={isSendingWhatsApp}
                            >
                                {isSendingWhatsApp
                                    ? "Sending..."
                                    : "Confirm & Send"}
                            </button>

                        </footer>

                    </section>

                </div>

            )}

        </div>
    );
}