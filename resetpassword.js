const SUPABASE_URL = 'https://tgptsuzheleshmtesbcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncHRzdXpoZWxlc2htdGVzYmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4ODA3NDQsImV4cCI6MjA3MDQ1Njc0NH0.pNTxZbSUeyATBlssBIZDrTyn1E2fr8bvCQ4mP3OQ-JM';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function resetPassword() {
	const statusText = document.getElementById("statustext");
	const newPassword = document.getElementById("password").value;

	if (!newPassword || newPassword.length < 6) {
		statusText.textContent = "Password must be at least 6 characters long.";
		statusText.style.color = 'red';
		return;
	}

	try {
		const { data, error } = await supabase.auth.updateUser({
			password: newPassword
		});

		if (error) {
			statusText.textContent = "Error: " + error.message;
			statusText.style.color = 'red';
		} else {
			statusText.textContent = "Password updated successfully!";
			statusText.style.color = 'black';
			setTimeout(() => {
				window.location.href = "https://16423-storm.github.io/Scoutmaster/index.html";
			}, 2000);
		}
	} catch (error) {
		statusText.textContent = "Unexpected error: " + error.message;
		statusText.style.color = 'red';
	}
}
