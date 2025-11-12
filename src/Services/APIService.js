export class ApiService {
  static async getData(endpoint, userToken) {
    var headers = {};

    if (userToken) {
      headers.Authorization = userToken;
    }

    const requestOptions = {
      method: "GET",
      headers: headers,
    };

    try {
      const response = await fetch(`${endpoint}`, requestOptions);

      if (!response.ok) {
        const errorResponse = await response.json();
        console.error(errorResponse.error, errorResponse.details);
        return;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Network or CORS error:", error.message);
    }
  }

  static async getText(endpoint) {
    const headers = {
      Accept: "text/plain, text/html",
    };

    const requestOptions = {
      method: "GET",
      headers: headers,
      credentials: "omit",
      redirect: "follow",
    };

    try {
      const response = await fetch(endpoint, requestOptions);

      if (!response.ok) {
        console.error("Template fetch failed with status:", response.status);
        return;
      }

      const contentType = (
        response.headers.get("content-type") || ""
      ).toLowerCase();
      if (!contentType.startsWith("text/")) {
        console.error("Unsupported template content-type:", contentType);
        return;
      }

      const contentLength = parseInt(
        response.headers.get("content-length") || "0",
        10
      );
      if (contentLength && contentLength > 200000) {
        console.error("Template too large (Content-Length exceeds 200KB)");
        return;
      }

      const text = await response.text();
      if (text.length > 200000) {
        console.error("Template too large (exceeds 200KB after reading)");
        return;
      }

      return text;
    } catch (error) {
      console.error("Network or CORS error loading template:", error.message);
    }
  }
}
