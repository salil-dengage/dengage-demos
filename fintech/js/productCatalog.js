(function () {
    const SOURCE_URL = 'novapay_products.json';

    let productsPromise = null;
    let productsById = new Map();

    function normalizeProduct(raw) {
        if (!raw || !raw.id) return null;

        const price = Number(raw.price);
        const oldPrice = raw.oldPrice !== undefined ? Number(raw.oldPrice) : null;
        const stock = raw.stock !== undefined ? Number(raw.stock) : NaN;
        const images = Array.isArray(raw.image) ? raw.image.filter(Boolean) : [];
        const colors = Array.isArray(raw.colors) ? raw.colors.filter(Boolean) : [];

        return {
            id: String(raw.id),
            name: raw.name || 'NovaPay Piece',
            desc: raw.desc || '',
            price: Number.isFinite(price) ? price : 0,
            oldPrice: Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : null,
            currency: raw.currency || 'USD',
            images,
            image: images[0] || '',
            category: raw.category || '',
            brand: raw.brand || '',
            availability: raw.availability !== false,
            /* Units in stock. Feeds stock_count on ec:addToWishlist, which the
               docs call out as the field a back-in-stock campaign needs, and the
               low-stock line in search results.

               null when the catalogue does not track stock, and the wishlist
               payload then omits stock_count rather than inventing one. The
               fintech and banking catalogues are deliberately in that case: a
               card or a mortgage has no unit count. Those two send price and
               discounted_price only, which is what a rate-drop alert needs. */
            stock: Number.isFinite(stock) && stock >= 0 ? stock : null,
            colors,
            url: 'product.html?id=' + encodeURIComponent(String(raw.id))
        };
    }

    function loadProducts() {
        if (!productsPromise) {
            productsPromise = fetch(SOURCE_URL, { cache: 'no-store' })
                .then(function (response) {
                    if (!response.ok) {
                        throw new Error('Failed to load products (' + response.status + ')');
                    }
                    return response.json();
                })
                .then(function (data) {
                    const list = Array.isArray(data) ? data : [];
                    const normalized = list
                        .map(normalizeProduct)
                        .filter(Boolean);

                    productsById = new Map();
                    normalized.forEach(function (product) {
                        productsById.set(product.id, product);
                    });

                    return normalized;
                })
                .catch(function (error) {
                    productsPromise = null;
                    throw error;
                });
        }

        return productsPromise;
    }

    function getProductById(id) {
        return loadProducts().then(function () {
            return productsById.get(String(id)) || null;
        });
    }

    /* Prices on this site are MONTHLY PLAN FEES, not one-off prices. Several
       products genuinely cost nothing, and "$0.00 a month" reads as a bug on a
       card that is simply free, so zero is spelled out.

       The check is explicit rather than `Number(value) || 0`, because that
       idiom turns a null into 0 and would label an unknown fee as free. An
       unknown fee is not a free product. */
    function formatPrice(value, currency) {
        var n = Number(value);
        if (!isFinite(n)) return '';
        if (n === 0) return 'Free';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD'
        }).format(n) + ' a month';
    }

    function buildProductUrl(id) {
        return 'product.html?id=' + encodeURIComponent(String(id));
    }

    window.NovaPayCatalogData = {
        loadProducts,
        getProductById,
        formatPrice,
        buildProductUrl
    };
})();
