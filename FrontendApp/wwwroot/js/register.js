class RegisterService {
    constructor() {
        this.baseUrl = '/api/auth';
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.baseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, data };
            } else {
                let errorText = 'Registration failed';
                try {
                    const errorData = await response.json();
                    errorText = errorData.error || errorText;
                    console.log('Registration failed with error:', errorText);
                } catch (e) {
                    errorText = `HTTP ${response.status}: ${response.statusText}`;
                    console.log('Registration failed with status:', errorText);
                }
                return { success: false, error: errorText };
            }
        } catch (error) {
            console.error('Registration NETWORK ERROR:', error);
            return {
                success: false,
                error: `Cannot connect to backend at ${this.baseUrl}`
            };
        }
    }
}

const registerService = new RegisterService();

document.addEventListener('DOMContentLoaded', function () {
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');

    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const userData = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                patronym: document.getElementById('patronym').value,
                email: document.getElementById('email').value,
                login: document.getElementById('login').value,
                password: document.getElementById('password').value
            };

            const submitBtn = registerForm.querySelector('.login-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Регистрация...';
            submitBtn.disabled = true;

            if (errorMessage) errorMessage.style.display = 'none';

            const result = await registerService.register(userData);

            if (result.success) {
                alert('Регистрация успешна! Теперь войдите в систему.');
                window.location.href = 'login.html';
            } else {
                console.log('Registration failed, showing error...');
                if (errorMessage) {
                    errorMessage.textContent = result.error;
                    errorMessage.style.display = 'block';
                }
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    } else {
        console.log('No register form on this page');
    }
});