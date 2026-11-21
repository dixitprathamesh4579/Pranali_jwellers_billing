const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL ||
    "https://pranali-jwellers-billing.onrender.com"
).replace(/\/+$/, "");

export const apiFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem("token");

    const headers = new Headers(options.headers || {});

    // Attach JWT token
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    // Automatically set JSON content type
    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    const cleanEndpoint = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint}`;

    const response = await fetch(
        `${API_BASE_URL}/api${cleanEndpoint}`,
        {
            ...options,
            headers,
        }
    );

    // Handle expired or invalid JWT
    if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.dispatchEvent(
            new Event("auth:unauthorized")
        );
    }

    return response;
};