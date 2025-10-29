class AuthService {
    constructor() {
        this.baseUrl = 'http://localhost:5104/api/auth';
        this.accessToken = localStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken');
    }

    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
    }

    async apiRequest(url, options = {}) {
        const config = {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        if (options.headers) {
            config.headers = {
                ...config.headers,
                ...options.headers
            };
        }

        if (this.accessToken) {
            config.headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        try {
            const response = await fetch(url, config);

            if (response.status === 401 && this.refreshToken) {
                const refreshed = await this.refreshTokens();
                if (refreshed) {
                    config.headers['Authorization'] = `Bearer ${this.accessToken}`;
                    return await fetch(url, config);
                } else {
                    this.redirectToLogin();
                    return null;
                }
            }

            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    async refreshTokens() {
        try {
            const response = await fetch(`${this.baseUrl}/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.refreshToken)
            });

            if (response.ok) {
                const data = await response.json();
                this.setTokens(data.accessToken, data.refreshToken);
                return true;
            } else {
                this.clearTokens();
                return false;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearTokens();
            return false;
        }
    }

    async login(login, password) {
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ login, password })
            });

            if (response.ok) {
                const data = await response.json();
                this.setTokens(data.accessToken, data.refreshToken);
                return { success: true, data };
            } else {
                const error = await response.json();
                return { success: false, error: error.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error' };
        }
    }

    async logout() {
        try {
            await this.apiRequest(`${this.baseUrl}/logout`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearTokens();
            this.redirectToLogin();
        }
    }

    async getCurrentUser() {
        try {
            const response = await this.apiRequest(`${this.baseUrl}/me`);

            if (response && response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    isAuthenticated() {
        return !!this.accessToken;
    }

    redirectToLogin() {
        window.location.href = 'login.html';
    }

    redirectToProfile() {
        window.location.href = 'profile.html';
    }
}

const authService = new AuthService();

document.addEventListener('DOMContentLoaded', function () {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const login = document.getElementById('login').value;
            const password = document.getElementById('password').value;

            const submitBtn = loginForm.querySelector('.login-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Вход...';
            submitBtn.disabled = true;

            if (errorMessage) {
                errorMessage.style.display = 'none';
            }

            const result = await authService.login(login, password);

            if (result.success) {
                authService.redirectToProfile();
            } else {
                if (errorMessage) {
                    errorMessage.textContent = result.error;
                    errorMessage.style.display = 'block';
                }
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }

    const protectedPages = ['profile.html', 'ecg-viewer.html'];
    const currentPage = window.location.pathname;

    if (protectedPages.some(page => currentPage.includes(page)) && !authService.isAuthenticated()) {
        authService.redirectToLogin();
        return;
    }

    if (window.location.pathname.includes('login.html') && authService.isAuthenticated()) {
        authService.redirectToProfile();
    }
});