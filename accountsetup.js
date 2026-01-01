const SUPABASE_URL = 'https://tgptsuzheleshmtesbcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncHRzdXpoZWxlc2htdGVzYmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4ODA3NDQsImV4cCI6MjA3MDQ1Njc0NH0.pNTxZbSUeyATBlssBIZDrTyn1E2fr8bvCQ4mP3OQ-JM';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = true;

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: 'https://16423-storm.github.io/Scoutmaster/index.html'
        }
    });

    if (!rememberMe) {
        localStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-tgptsuzheleshmtesbcx-auth-token');
    }


    const statusText = document.getElementById("statustext");
    const statusTextContainer = document.getElementById("statustextcontainer")
    if (error) {
        statusTextContainer.style.display = 'block';
        statusText.textContent = error.message;
        statusText.style.color = 'red';
    } else {
        statusTextContainer.style.display = 'block';
        statusText.textContent = 'Check your email to confirm sign-up!';
        statusText.style.color = 'black';
        document.getElementById("signupprompt").textContent = "Didn't get an email? Resend verification link&nbsp;<span class='signuppromptspan' onclick='resendEmail()'>here!</span> "
    }

}

async function signIn() {
    const statusText = document.getElementById("statustext");
    const statusTextContainer = document.getElementById("statustextcontainer")
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = true;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        statusTextContainer.style.display = 'block';
        statusText.textContent = "Login failed: "+error.message;
        statusText.style.color = 'red';
    } else {
        if (!rememberMe) {
            localStorage.removeItem('supabase.auth.token');
            localStorage.removeItem('sb-tgptsuzheleshmtesbcx-auth-token');
        }

        statusTextContainer.style.display = 'block';
        statusText.textContent = 'Login successful!';
        statusText.style.color = 'black';
        window.location.href = 'https://16423-storm.github.io/Scoutmaster/index.html';
    }
}

function signUpPrompted(){
    document.getElementById("signupbutton").style.display = "block";
    document.getElementById("signinbutton").style.display = "none";
    document.getElementById("signupprompt").style.display = "none";
    document.getElementById("statustext").textContent = "";
}

async function resendEmail() {
    const email = document.getElementById('email').value;

    try {
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: 'https://storm16423.ca/Scoutmaster/index.html'
            }
        });

        if (error) {
            console.error('Resend email error:', error.message);
            document.getElementById("statustext").textContent = error.message;
            document.getElementById("statustext").style.color = 'red';
        } else {
            document.getElementById("statustext").textContent = 'Confirmation email resent! Please check your inbox.';
            document.getElementById("statustext").style.color = 'black';
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        document.getElementById("statustext").textContent = error.message || 'An unexpected error occurred.';
        document.getElementById("statustext").style.color = 'red';
    }
}

function prepForResetPassword(){
    document.getElementById("password").style.display = "none";
    document.getElementById("signinbutton").textContent = "Reset Password";
    document.getElementById("statustext").textContent = "";
    document.getElementById("signupprompt").textContent = "";
    document.getElementById("signinbutton").onclick = resetPassword;
}

async function resetPassword() {
    const email = document.getElementById('email').value;

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://storm16423.ca/Scoutmaster/resetpassword.html'
        });

        if (error) {
            console.error('Password reset error:', error.message);
            document.getElementById("statustext").textContent = error;
            document.getElementById("statustext").style.color = 'red';
        } else {
            document.getElementById("statustext").textContent = 'Password reset email sent successfully! Please check your inbox.';
            document.getElementById("statustext").style.color = 'black';
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        document.getElementById("statustext").textContent = error;
        document.getElementById("statustext").style.color = 'red';
    }
}
