export const generateId = () => Math.random().toString(36).substr(2, 9);

export const formatCurrency = (amount, currency = 'USD') => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(num);
};

export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
