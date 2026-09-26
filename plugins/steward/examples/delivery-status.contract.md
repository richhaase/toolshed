# Explain failed deliveries

Goal: Dispatchers can understand a failed delivery without reading server logs.

Success:
- Delivery details explain a rejection using the available safe reason, or a
  helpful fallback when no safe reason is available.

Boundaries: Use the existing classification of safe upstream text; never expose
text it marks unsafe. Upstream delivery behavior and localization are outside
this change.
