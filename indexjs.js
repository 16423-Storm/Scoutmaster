const SUPABASE_URL = 'https://tgptsuzheleshmtesbcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncHRzdXpoZWxlc2htdGVzYmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4ODA3NDQsImV4cCI6MjA3MDQ1Njc0NH0.pNTxZbSUeyATBlssBIZDrTyn1E2fr8bvCQ4mP3OQ-JM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const savedGroupId = localStorage.getItem('groupId');
const savedSupabaseUrl = localStorage.getItem('supabaseUrl');

var groupId = savedGroupId;
var onContinueAfterWarning;
var groupMembers;
var invitedMembers;
var scoutedCompetitionKey;
var currentEventKey;
var autoSVGs = [];

function popUpWarning(message, onContinue){
    document.getElementById("warningpopup").style.display = "block";
    document.getElementById("backdrop").style.display = "block";
    document.getElementById("warningmessage").textContent = message;

    onContinueAfterWarning = onContinue;
}

function popUpCancel(){
    document.getElementById("warningpopup").style.display = "none";
    document.getElementById("backdrop").style.display = "none";
    onContinueAfterWarning = null;
}

function popUpContinue(){
    if (typeof onContinueAfterWarning === "function") {
        onContinueAfterWarning();
    }
    document.getElementById("warningpopup").style.display = "none";
    document.getElementById("backdrop").style.display = "none";
    onContinueAfterWarning = null;
}

function invitePopUpOpen(){
    document.getElementById("invitepopup").style.display = "block";
    document.getElementById("backdrop").style.display = "block";
}

function invitePopUpCancel(){
    document.getElementById("invitepopup").style.display = "none";
    document.getElementById("backdrop").style.display = "none";
}

async function joinGroup() {
	const errorHandleText = document.getElementById("errorhandletext");
	errorHandleText.textContent = "";
	errorHandleText.style.color = "";

	const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
	if (sessionError || !session) {
		errorHandleText.textContent = "You must be logged in to join a group.";
		errorHandleText.style.color = "red";
		return;
	}

	const userEmail = session.user.email;
	const userId = session.user.id;

    const groupToJoinId = document.getElementById("joingroupinput").value

	if (!groupToJoinId) {
		errorHandleText.textContent = "No group selected to join.";
		errorHandleText.style.color = "red";
		return;
	}

	const { data: groupData, error: groupError } = await supabaseClient
		.from('group')
		.select('invited, members')
		.eq('id', groupToJoinId)
		.maybeSingle();

	if (groupError || !groupData) {
		errorHandleText.textContent = "Failed to load group data.";
		errorHandleText.style.color = "red";
		console.error(groupError);
		return;
	}

	const invited = Array.isArray(groupData.invited) ? groupData.invited : [];
	const members = typeof groupData.members === 'string' ? JSON.parse(groupData.members) : groupData.members || [];

	if (!invited.includes(userEmail.toLowerCase())) {
		errorHandleText.textContent = "You are not invited to join this group.";
		errorHandleText.style.color = "red";
		return;
	}

	const alreadyMember = members.some(m => m.email.toLowerCase() === userEmail.toLowerCase());
	if (alreadyMember) {
		errorHandleText.textContent = "You are already a member of this group.";
		errorHandleText.style.color = "red";
		return;
	}

	members.push({ id: userId, email: userEmail, isAdmin: false });

	const { error: updateGroupError } = await supabaseClient
		.from('group')
		.update({ members: members })
		.eq('id', groupToJoinId);

	if (updateGroupError) {
		errorHandleText.textContent = "Failed to add you to the group members.";
		errorHandleText.style.color = "red";
		console.error(updateGroupError);
		return;
	}

	const { error: userGroupError } = await supabaseClient
		.from('usergroup')
		.insert({ id: userId, group_id: groupToJoinId });

	if (userGroupError) {
		errorHandleText.textContent = "Failed to update your group membership.";
		errorHandleText.style.color = "red";
		console.error(userGroupError);
		return;
	}

    const updatedInvited = invited.filter(email => email.toLowerCase() !== userEmail.toLowerCase());

    const { error: invitedUpdateError } = await supabaseClient
        .from('group')
        .update({ invited: updatedInvited })
        .eq('id', groupToJoinId);

    if (invitedUpdateError) {
        console.error("Failed to remove user from invited list:", invitedUpdateError.message);
    }


	errorHandleText.textContent = "";
	checkGroupMembership();
	statusPopUp("You have successfully joined the group!");
}


async function inviteUser() {
    const inputVal = document.getElementById("invitepopupinput").value.trim().toLowerCase();

    if (!inputVal) {
        statusPopUp("Please enter a valid email.");
        return;
    }

    if (!groupId) {
        console.error("No groupId set");
        return;
    }

    if (invitedMembers.includes(inputVal)) {
        statusPopUp("This email is already invited.");
        return;
    }

    const updatedInvites = [...invitedMembers, inputVal];

    const { error: updateError } = await supabaseClient
        .from('group')
        .update({ invited: updatedInvites })
        .eq('id', groupId);

    if (updateError) {
        console.error("Error updating invited list:", updateError.message);
        statusPopUp("Failed to invite user.");
        return;
    }

    await loadInvitedUsers();

    document.getElementById("invitepopupinput").value = " ";
    document.getElementById("invitepopup").style.display = "none";
    document.getElementById("backdrop").style.display = "none";

    statusPopUp(`Invited ${inputVal} successfully!`);
}


async function loadInvitedUsers() {
    if (!groupId) {
        console.warn("No groupId set");
        return;
    }

    const { data: groupData, error: groupError } = await supabaseClient
        .from('group')
        .select('invited')
        .eq('id', groupId)
        .maybeSingle();

    if (groupError || !groupData) {
        console.error('Error fetching invited users:', groupError);
        return;
    }

    invitedMembers = Array.isArray(groupData.invited) 
        ? groupData.invited.map(item => typeof item === 'object' && item !== null ? item.email : item)
        : [];


    const invitedTbody = document.getElementById("invitedtbody");
    invitedTbody.innerHTML = "";

    invitedMembers.forEach(email => {
        const newRow = document.createElement("tr");
        const emailCell = document.createElement("td");
        emailCell.classList.add("invitedlistemail");
        emailCell.textContent = email; 
        newRow.appendChild(emailCell);
        invitedTbody.appendChild(newRow);
    });

}


//dark mode toggle
function darkmodetoggle(){
    const targetBody = document.body;
    const sunMoonImg = document.getElementById("imgToToggle");
    const accountButtonImg = document.getElementById("accountbuttonimg")

    targetBody.classList.toggle("darkmode");
    if(targetBody.classList.contains("darkmode")){
        document.cookie = "darklight=dark; path=/; max-age=31536000; SameSite=Lax; Secure";
        sunMoonImg.src = "images/sun.png";
        accountButtonImg.src = "images/accountwhite.png"
    } else {
        document.cookie = "darklight=light; path=/; max-age=31536000; SameSite=Lax; Secure";
        sunMoonImg.src = "images/moon.png";
        accountButtonImg.src = "images/accountblack.png"
    }
}

//load specific cookie
function getCookie(name) {
    const cookies = document.cookie.split('; ');
    for (let cookie of cookies) {
        const [key, value] = cookie.split('=');
        if (key === name) {
            return value;
        }
    }
    return null;
}

//loading cookies
function loadcookies(){
    //loading dark theme pref cookie
    const targetBody = document.body;
    const theme = getCookie("darklight");

    if(theme === "dark"){
        darkmodetoggle();
    }
}

window.onload = function(){
    document.body.classList.add("lock-scroll");
    document.getElementById("blackout").style.display = "block";
    document.getElementById("loadingimgcontainer").style.display = "block";
    window.setTimeout(actualLoad, 3000);
}

function actualLoad(){
    document.body.classList.remove("lock-scroll");
    document.getElementById("blackout").style.display = "none";
    document.getElementById("loadingimgcontainer").style.display = "none";
    localStorage.setItem('supabaseUrl', SUPABASE_URL);
    loadcookies();
    useSessionData();
    loadStartingComp();  
}

// button to go to login page
function goToLogIn(){
    window.location.href = "signup.html";
}

// check if user is already logged in or not
async function useSessionData(){
    const isLoggedIn = await isUserLoggedIn();
    if(isLoggedIn){
        document.getElementById("signedoutmainbody").style.display = "none";
        document.getElementById("signedinmainbody").style.display = "block";
        document.getElementById("accountbutton").style.display = "block";
        checkGroupMembership();
    } else {
        document.getElementById("signedoutmainbody").style.display = "block";
        document.getElementById("signedinmainbody").style.display = "none";
        document.getElementById("accountbutton").style.display = "none";
    }
}

// checking if user is in a group
async function checkGroupMembership() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error || !session || !session.user) {
        console.log("Not logged in");
        document.getElementById('ingroupmainbody').style.display = "none";
        document.getElementById('notingroupmainbody').style.display = "block";
        document.getElementById('notingroupbuttons').style.display = "block";
        return;
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    const { data, error: fetchError } = await supabaseClient
        .from('usergroup')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (fetchError) {
        console.error("Error checking usergroup:", fetchError);
        return;
    }

    if (data) {
        groupId = data.group_id;

        localStorage.setItem('groupId', groupId);

        const { data: groupData, error: groupError } = await supabaseClient
            .from('group')
            .select('members')
            .eq('id', groupId)
            .maybeSingle();

        if (groupError) {
            console.error("Error fetching group info:", groupError);
            return;
        }

        if (!groupData) {
            console.warn("Group does not exist. Removing usergroup entry.");

            const { error: deleteError } = await supabaseClient
                .from('usergroup')
                .delete()
                .eq('id', userId);

            if (deleteError) {
                console.error("Failed to delete usergroup row:", deleteError);
                return;
            }

            statusPopUp("Your group was deleted. Please join or create a new group.");
            document.getElementById("ingroupmainbody").style.display = "none";
            document.getElementById("notingroupmainbody").style.display = "block";
            document.getElementById('notingroupbuttons').style.display = "block";
            return;
        }

        groupMembers = typeof groupData.members === 'string'
            ? JSON.parse(groupData.members)
            : groupData.members;


        const members = typeof groupData.members === 'string'
            ? JSON.parse(groupData.members)
            : groupData.members;

        const member = members?.find(m => m.id === userId || m.email === userEmail);


        if (!member) {
            console.warn("User not found in group's members. Removing usergroup entry.");

            const { error: deleteError } = await supabaseClient
                .from('usergroup')
                .delete()
                .eq('id', userId);

            if (deleteError) {
                console.error("Failed to delete usergroup row:", deleteError);
                return;
            }

            statusPopUp("You were removed from the group. Please join again or contact an admin.");
            document.getElementById("ingroupmainbody").style.display = "none";
            document.getElementById("notingroupmainbody").style.display = "block";
            document.getElementById('notingroupbuttons').style.display = "block";
            return;
        }

        const isAdmin = member?.isAdmin === true;

        document.getElementById("ingroupmainbody").style.display = "block";
        document.getElementById("notingroupmainbody").style.display = "none";
        document.getElementById('notingroupbuttons').style.display = "none";

        if (isAdmin) {
            document.getElementById("adminviewbodycontainer").style.display = "flex";
            document.getElementById("regviewbodycontainer").style.display = "flex";
            loadMembers();
            loadInvitedUsers();
        } else {
            document.getElementById("adminviewbodycontainer").style.display = "none";
            document.getElementById("regviewbodycontainer").style.display = "flex";
        }
    } else {
        document.getElementById("ingroupmainbody").style.display = "none";
        document.getElementById("notingroupmainbody").style.display = "block";
        document.getElementById('notingroupbuttons').style.display = "block";
    }
}




async function isUserLoggedIn() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Session check failed:", error.message);
        return false;
    }

    return !!session;
}

// new group/existing group join

function newButtonClick(){
    document.getElementById("notingrouptext").style.display = "none";
    document.getElementById("notingroupbuttons").style.display = "none";
    document.getElementById("creategroupcontainer").style.display = "flex";
}

function existingButtonClick(){
    document.getElementById("notingrouptext").style.display = "none";
    document.getElementById("notingroupbuttons").style.display = "none";
    document.getElementById("joingroupcontainer").style.display = "flex";
}

async function createGroup() {
    const groupName = document.getElementById('groupnameinput').value;

    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError || !session) {
        console.error("No active session or error fetching session:", sessionError);
        return;
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    let maxRetries = 3;
    let attempt = 0;
    let groupCreated = false;

    while (attempt < maxRetries && !groupCreated) {
        attempt++;

        const { data: maxData, error: maxError } = await supabaseClient
            .from('group')
            .select('id')
            .order('id', { ascending: false })
            .limit(1);

        if (maxError) {
            console.error("Failed to fetch max group ID:", maxError.message);
            return;
        }

        const newId = maxData.length > 0 ? maxData[0].id + 1 : 1;

        const membersArray = [
            { id: userId, email: userEmail, isAdmin: true }
        ];

        const groupData = {
            id: newId,
            group_name: groupName,
            made: new Date().toISOString(),
            members: membersArray
        };

        const { error: insertError } = await supabaseClient
            .from('group')
            .insert(groupData);

        if (!insertError) {
            statusPopUp(`Group "${groupName}" created with ID ${newId}`);

            const userGroupDataToInsert = {
                id: userId,  
                group_id: newId,  
            };

            const { error: userGroupInsertError } = await supabaseClient
                .from('usergroup')
                .insert(userGroupDataToInsert);

            if (userGroupInsertError) {
                console.error("Failed to insert into usergroup:", userGroupInsertError.message);
                return;
            }

            groupCreated = true;
            checkGroupMembership();
        } else if (insertError.code === '23505') {
            console.warn(`ID ${newId} already exists. Retrying...`);
        } else {
            console.error("Error creating group:", insertError.message);
            return;
        }
    }

    if (!groupCreated) {
        statusPopUp("Failed to create group. Please try again.");
    }
}

async function loadMembers() {
	const tbody = document.getElementById("memberlisttbody");
	tbody.innerHTML = "";

	groupMembers.forEach(member => {
		const newRow = document.createElement("tr");

		const cellEmail = document.createElement("td");
		cellEmail.classList.add("memberlistemail");
		cellEmail.textContent = member.email;
		newRow.appendChild(cellEmail);

		const cellCheckbox = document.createElement("td");
		const adminCheckbox = document.createElement("input");
		adminCheckbox.type = "checkbox";
		adminCheckbox.checked = !!member.isAdmin;

        cellEmail.onclick = function() {
            popUpWarning(
            "Clicking continue will remove this member from this group, are you 100% sure you want to continue?", 
            () => removeFromGroup(this.textContent)
            );
        };


		if(!!member.isAdmin){
			const firstCell = newRow.querySelector('td');
			if (firstCell) {
				firstCell.style.backgroundColor = 'red';
			}
		}

		const changedStar = document.createElement("span");
		changedStar.textContent = "*";
		changedStar.style.border = "none";
		changedStar.style.outline = "none";
		changedStar.style.marginLeft = "5px";
		changedStar.style.display = "none"; 

		adminCheckbox.addEventListener("change", () => {
			if (adminCheckbox.checked !== !!member.isAdmin) {
				changedStar.style.display = "inline";
			} else {
				changedStar.style.display = "none";
			}
		});

		cellCheckbox.appendChild(adminCheckbox);
		cellCheckbox.appendChild(changedStar);
		newRow.appendChild(cellCheckbox);

		tbody.appendChild(newRow);
	});
}


async function adminUpdate() {
  if (!groupId) {
    console.error("No groupId set");
    return;
  }

  const tbody = document.getElementById("memberlisttbody");
  const rows = tbody.querySelectorAll("tr");

  rows.forEach(row => {
    const cells = row.querySelectorAll("td");
    const email = cells[0].textContent.trim();
    const checkbox = cells[1].querySelector("input[type='checkbox']");
    if (!checkbox) return;

    const member = groupMembers.find(m => m.email === email);
    if (member) {
      member.isAdmin = checkbox.checked;
    }
  });

  const { error: updateError } = await supabaseClient
    .from('group')
    .update({ members: groupMembers })
    .eq('id', groupId);

  if (updateError) {
    console.error('Failed to update members in group:', updateError);
  } else {
    statusPopUp('Admin changes saved!');
    checkGroupMembership();
  }
}





//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// ACCOUNT MANAGEMENT AFTER HERE
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

var previousDivIdsVisible = [];

function goToAccountPage(){
    previousDivIdsVisible = Array.from(document.getElementById("signedinmainbody").children)
    .filter(child => {
        const style = window.getComputedStyle(child);
        return style.display !== 'none';
    }).map(child => {
        const style = window.getComputedStyle(child);
        return{
            id: child.id,
            display: style.display
        }
    });
    document.getElementById("accountmanagebody").style.display = "block";

    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = "none";
    });
}

function goBackFromAccount(){
    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = div.display;
    });
    document.getElementById("accountmanagebody").style.display = "none";
}



//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// ACCOUNT MANAGEMENT BEFORE HERE
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!









async function logOut() {
    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    
    if (error) {
        console.error('Error logging out:', error.message);
    } else {
        console.log('Successfully logged out from local session.');
        window.location.href = "index.html";
    }
}

async function changePassword() {
    const newPassword = document.getElementById("changepasswordinput").value;

    const { data, error } = await supabaseClient.auth.updateUser({
        password: newPassword,
    });

    if (error) {
        console.error('Password change error:', error.message);
        statusPopUp('Password change error:', `${error.message}`);
    } else {
        statusPopUp("Password changed successfully");
        console.log('Password successfully updated.');
    }
}

async function leaveGroup() {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
        console.error('No user logged in or error fetching session:', sessionError?.message);
        return;
    }

    const memberId = session.user.id;

    if (!groupId) {
        console.error('No groupId available. Cannot leave group.');
        return;
    }

    const { data, error } = await supabaseClient.rpc('remove_member_from_jsonb', {
        row_id: groupId,
        member_id: memberId
    });

    if (error) {
        console.error('Error removing member from JSONB:', error.message);
    } else {
        console.log('Member removed successfully from group.');

        const { error: userGroupError } = await supabaseClient
            .from('usergroup')
            .delete()
            .eq('id', memberId);

        if (userGroupError) {
            console.error('Error removing usergroup entry:', userGroupError.message);
        } else {
            console.log('Usergroup entry removed.');
        }

        statusPopUp("You have left your group");

        checkGroupMembership(); 
    }
}

async function removeFromGroup(kickedEmail){
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
        console.error('No user logged in or error fetching session:', sessionError?.message);
        return;
    }

    var memberId;

    for(i in groupMembers){
        if(groupMembers[i].email === kickedEmail){
            memberId = groupMembers[i].id
            break;
        }
    }

    if (!memberId) {
        console.error('Member ID not found for email:', kickedEmail);
        return;
    }

    if (!groupId) {
        console.error('No groupId available. Cannot leave group.');
        return;
    }

    const { data, error } = await supabaseClient.rpc('remove_member_from_jsonb', {
        row_id: groupId,
        member_id: memberId
    });

    if (error) {
        console.error('Error removing member from JSONB:', error.message);
    } else {
        console.log('Member removed successfully from group.');

        const { error: userGroupError } = await supabaseClient
            .from('usergroup')
            .delete()
            .eq('id', memberId);

        if (userGroupError) {
            console.error('Error removing usergroup entry:', userGroupError.message);
        } else {
            console.log('Usergroup entry removed.');
        }

        statusPopUp("You have left your group");

        checkGroupMembership(); 
    }
}



async function deleteAccount() {
    await leaveGroup();
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const accessToken = session?.access_token;

        if (!accessToken) {
            throw new Error('No active session');
        }

        const response = await fetch(`${savedSupabaseUrl}/functions/v1/delete-user`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to delete user');
        }

        await logOut();

        window.location.href = "index.html";
        
        return true;
    } catch (error) {
        console.error('User deletion error:', error);
        throw error;
    }
}


function statusPopUp(message){
    document.getElementById("statuspopup").style.display = "block";
    document.getElementById("backdrop").style.display = "block";
    document.getElementById("statuspopuptext").textContent = message;
}

function statusPopUpClose(){
    document.getElementById("statuspopup").style.display = "none";
    document.getElementById("backdrop").style.display = "none";    
}

window.logOut = logOut;
window.changePassword = changePassword;
window.leaveGroup = leaveGroup;
window.deleteAccount = deleteAccount; 
window.popUpWarning = popUpWarning;
window.statusPopUpClose = statusPopUpClose;





//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// ORANGE ALLIANCE STUFF BELOW
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const ORANGE_API_KEY = 'qZJBdBp3HybnNrouyxbplVsEW31zLpYRARM+B0wmNrU=';
let allEventsMap = new Map();

async function loadStartingComp() {
    if (!groupId) {
        console.warn("No groupId set");
        return;
    }

    const { data: groupData, error: groupError } = await supabaseClient
        .from('group')
        .select('competition')
        .eq('id', groupId)
        .maybeSingle();

    console.log('Raw Supabase groupData:', groupData);

    if (groupError) {
        console.error('Error fetching group:', groupError);
        statusPopUp('Error fetching group:', groupError);
        return;
    }

    if (!groupData) {
        console.warn('Supabase returned null for group data');
        return;
    }

    const scoutedCompetitionKey = groupData.competition;
    currentEventKey = scoutedCompetitionKey;
    console.log('scoutedCompetitionKey:', scoutedCompetitionKey);

    if (!scoutedCompetitionKey) {
        console.log('No competition set');
        return;
    }

    try {
        const response = await fetch(`https://theorangealliance.org/api/event/${scoutedCompetitionKey}`, {
            headers: {
                'X-TOA-Key': ORANGE_API_KEY,
                'X-Application-Origin': 'scoutmaster'
            }
        });

        if (!response.ok) throw new Error(`${response.status} - ${response.statusText}`);

        const eventArray = await response.json();
        const event = eventArray[0];

        document.getElementById("compinfo").textContent = `Currently Scouting: ${event.event_name}`;
        document.getElementById("competitionnameinprescoutlist").textContent = event.event_name;
    } catch (error) {
        console.error('Failed to load event:', error);
        alert('Could not fetch event info.');
    }
}



document.getElementById("compsearchinput").addEventListener("input", async function() {
    const compSearchInputVal = this.value.toLowerCase();
    const container = document.getElementById("comptabcontainer");

    if(compSearchInputVal.trim() === ""){
        container.innerHTML = '';
    }

    if (allEventsMap.size === 0) {
        try {
            const response = await fetch('https://theorangealliance.org/api/event?season_key=2425', {
                headers: {
                'X-TOA-Key': ORANGE_API_KEY,
                'X-Application-Origin': 'scoutmaster',
                'Content-Type': 'application/json'
                }
        });

        if (!response.ok) throw new Error(`Error: ${response.status} - ${response.statusText}`);

        const events = await response.json();

        events.forEach(event => {
            allEventsMap.set(event.first_event_code.toLowerCase(), event);
        });

        } catch (error) {
            console.error('Failed to load events:', error);
            alert('Could not fetch event codes.');
            return;
        }
    }

    const matchingKeys = [...allEventsMap.keys()]
        .filter(key => key.includes(compSearchInputVal))
        .slice(0, 5);

    container.innerHTML = '';

    if (matchingKeys.length === 0) {
        container.innerHTML = '<p>No competitions found.</p>';
        return;
    }

    matchingKeys.forEach(key => {
        const event = allEventsMap.get(key);
        const startDate = new Date(event.start_date).toDateString();
        const endDate = new Date(event.end_date).toDateString();

        container.innerHTML += `
        <div class="comptab" style="border-width: 1px;" data-event-key="${event.event_key}" data-event-name="${event.event_name}" onclick="checkCompFirst(this)">
            <p class="comptabbigtext">${event.event_name}</p>
            <p class="comptabsmalltext">${event.first_event_code.toUpperCase()}</p>
            <p class="comptabsmalltext">${startDate} - ${endDate}</p>
        </div>`;
    });
});

async function checkCompFirst(element){
    const event = element.dataset.eventKey
    const name = element.dataset.eventName
    popUpWarning("Selecting this will delete ALL data currently saved related to your current competition, are you 100% sure you want to continue?", () => setScoutedCompetition(event, name));
}

async function setScoutedCompetition(eventKey, eventName){
    const { error: groupError } = await supabaseClient
        .from('group')
        .upsert({
            id: groupId,             
            competition: eventKey   
        });

    if(groupError){
        console.error('Error fetching invited users:', groupError);
        statusPopUp('Error fetching invited users:', groupError);
    }

    statusPopUp("Successfully scouting new competition!");
    document.getElementById("compinfo").textContent = `Currently Scouting: ${eventName}`;
    document.getElementById("competitionnameinprescoutlist").textContent = eventName;
}







//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// ACTUAL SCOUTING DOWN HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

function showPrescout(){
    previousDivIdsVisible = Array.from(document.getElementById("ingroupmainbody").children)
    .filter(child => {
        const style = window.getComputedStyle(child);
        return style.display !== 'none';
    }).map(child => {
        const style = window.getComputedStyle(child);
        return{
            id: child.id,
            display: style.display
        }
    });

    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = "none";
    });

    document.getElementById("prescoutbodycontainer").style.display = "flex";
    document.getElementById("prescoutteamslist").style.display = "flex";
    pullAllTeamsPrescout();
}

function goBackFromPrescout(){
    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = div.display;
    });
    document.getElementById("prescoutbodycontainer").style.display = "none";
}

function showMatchScout(){
    previousDivIdsVisible = Array.from(document.getElementById("ingroupmainbody").children)
    .filter(child => {
        const style = window.getComputedStyle(child);
        return style.display !== 'none';
    }).map(child => {
        const style = window.getComputedStyle(child);
        return{
            id: child.id,
            display: style.display
        }
    });

    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = "none";
    });

    document.getElementById("matchscoutbodycontainer").style.display = "flex";
}

function goBackFromMatchScout(){
    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = div.display;
    });
    document.getElementById("matchscoutbodycontainer").style.display = "none";
}

function showAllianceSelection(){
    previousDivIdsVisible = Array.from(document.getElementById("ingroupmainbody").children)
    .filter(child => {
        const style = window.getComputedStyle(child);
        return style.display !== 'none';
    }).map(child => {
        const style = window.getComputedStyle(child);
        return{
            id: child.id,
            display: style.display
        }
    });

    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = "none";
    });

    document.getElementById("allianceselectionbodycontainer").style.display = "flex";
}

function goBackFromAllianceSelection(){
    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = div.display;
    });
    document.getElementById("allianceselectionbodycontainer").style.display = "none";
}


async function pullAllTeamsPrescout() {
	try {
		const response = await fetch(`https://theorangealliance.org/api/event/${currentEventKey}/teams`, {
			headers: {
				'X-TOA-Key': ORANGE_API_KEY,
				'X-Application-Origin': 'scoutmaster',
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) throw new Error(`Error: ${response.status} - ${response.statusText}`);

		const teams = await response.json();
		teams.sort((a, b) => a.team.team_number - b.team.team_number);

		const tbody = document.getElementById("prescoutteamstbody");

		const { data, error } = await supabaseClient.rpc('check_prescout_empty', { p_groupid: groupId });

		if (error) {
			console.error('RPC error:', error.message);
			return;
		}

		if (data === true) {
			console.log('Prescout is empty or null');

			for (const team of teams) {
				const teamJsonb = {
					ability1: null,
					ability2: null,
					ability3: null,
					notes: "",
					autosvg: [],
					strategy: "",
					finalized: 0
				};

				const { error: rpcError } = await supabaseClient.rpc('add_team_to_prescout', {
					p_groupid: groupId,
					p_teamnum: team.team.team_number,
					p_teamdata: teamJsonb
				});

				if (rpcError) {
					console.error(`Failed to update prescout for team ${team.team.team_number}:`, rpcError);
				}
			}

			tbody.innerHTML = '';
			teams.forEach(team => {
				tbody.innerHTML += `
					<tr class="prescouttablerow" data-team-info='${JSON.stringify(team)}' onclick="goToTeamPrescoutPage(this)">
						<td>${team.team.team_number} - ${team.team.team_name_short}</td>
						<td style="width: 20%"></td>
					</tr>
				`;
			});
		} else {
			console.log('Prescout has data');

			const { data: finalizedData, error: finalizedError } = await supabaseClient.rpc('get_finalized_list', { p_groupid: groupId });

			if (finalizedError) {
				console.error('RPC error:', finalizedError);
				return;
			}

			console.log('Finalized list:', finalizedData);

			finalizedData.sort((a, b) => parseInt(a.teamnum, 10) - parseInt(b.teamnum, 10));

			const finalizedMap = new Map();
			finalizedData.forEach(entry => {
				finalizedMap.set(entry.teamnum.toString(), entry.finalized === 1);
			});

			tbody.innerHTML = '';
			teams.forEach(team => {
				const teamNum = team.team.team_number;
				const isFinalized = finalizedMap.get(teamNum.toString()) || false;

				tbody.innerHTML += `
					<tr class="prescouttablerow" data-team-info='${JSON.stringify(team)}' data-team-is-finalized="${isFinalized}" onclick="goToTeamPrescoutPage(this)">
						<td>${teamNum} - ${team.team.team_name_short}</td>
						<td style="width: 20%">
							${isFinalized ? '<img style="width: 80%; height: auto;" src="images/checkmark.png">' : ''}
						</td>
					</tr>
				`;
			});
		}
	} catch (error) {
		console.error('Failed to load teams:', error);
		alert('Could not fetch teams.');
		return;
	}
}

function goToTeamPrescoutPage(element){
    const teamInfoObj = JSON.parse(element.dataset.teamInfo);
    const teamIsFinalized = element.dataset.teamIsFinalized;
    console.log(teamInfoObj, null, 2);
    currentPrescoutTeam = teamInfoObj.team.team_key;

    document.getElementById("prescoutteamslist").style.display = "none";
    document.getElementById("prescoutteampage").style.display = "flex";
    document.getElementById("prescoutallthewaybackbutton").style.display = "none";

    document.getElementById("teamnumnameprescout").textContent = `${teamInfoObj.team.team_number} - ${teamInfoObj.team.team_name_short}`
    document.getElementById("teamrookieyearprescout").textContent = `Rookie Year: ${teamInfoObj.team.rookie_year}`;
    document.getElementById("teamlocationprescout").textContent = `${teamInfoObj.team.city}, ${teamInfoObj.team.state_prov} - ${teamInfoObj.team.country}`;

    if(teamIsFinalized === "true"){
        alert("finalized")
        disableDrawing();
        loadPrescoutForTeam();
        hideAutoEditButtons();
        lockNoUse = true;
        lockFinalized = true;
    }else{
        unlockAndClearPrescoutInputs();
        alert("not finalized");
        lockNoUse = false;
        enableDrawing();
        showAutoEditButtons();
        lockFinalized = false;
    }
}

var lockNoUse = false;
var lockFinalized = false;
var currentPrescoutTeam;

function goBackFromTeamPagePreScout(){
    unlockAndClearPrescoutInputs();
    clearCurrentPath();
    document.getElementById("prescoutteamslist").style.display = "flex";
    document.getElementById("prescoutteampage").style.display = "none";
    document.getElementById("prescoutallthewaybackbutton").style.display = "block";
    autoSVGs = [];
    updateAutoPathDisplay();
    updateFinalizedStatusInTable();
    lockNoUse = false;
}

function showAutoOverlay(){
    disableDrawing();
    document.getElementById("autopathsoverlay").style.display = "block";
    document.getElementById("backdrop").style.display = "block";
    document.body.classList.add("lock-scroll");
    if(autoSVGs.length >= 5 || lockFinalized){
        document.getElementById("newautopathbutton").style.display = "none";
        hideAutoEditButtons();
    }else{
        if(!lockFinalized){
            document.getElementById("newautopathbutton").style.display = "block";
        }
        showAutoEditButtons();
    }
}

function closeAutoPathPopup(){
    document.getElementById("autopathsoverlay").style.display = "none";
    document.getElementById("backdrop").style.display = "none";
    document.body.classList.remove("lock-scroll");
}

function newAutoPath(){
    enableDrawing();
    document.getElementById("autopathsection1").style.display = "none";
    document.getElementById("autopathsection2").style.display = "none";
    document.getElementById("autopathsection3").style.display = "flex";
    document.getElementById("autopathsection4").style.display = "flex";
}

function exitAutoPathCreationWoutSaving(){
    disableDrawing();
    clearCurrentPath();
    document.getElementById("autopathsection1").style.display = "flex";
    document.getElementById("autopathsection2").style.display = "flex";
    document.getElementById("autopathsection3").style.display = "none";
    document.getElementById("autopathsection4").style.display = "none";
}



const svg = document.getElementById('drawablesvg');
var points = [];

const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
path.setAttribute("stroke", "white");
path.setAttribute("stroke-width", "2");
path.setAttribute("fill", "none");
svg.appendChild(path);

function handlePointer(event) {
	event.preventDefault();

	const point = event.touches ? event.touches[0] : event;

	const pt = svg.createSVGPoint();
	pt.x = point.clientX;
	pt.y = point.clientY;

	const svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());

	points.push({ x: svgPoint.x, y: svgPoint.y });

	const d = points.map((p, i) =>
		i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
	).join(' ');

	path.setAttribute('d', d);
}

let drawingEnabled = true;


function clearCurrentPath(){
	path.setAttribute('d', '');
    points = [];
}

function exitAutoPathCreationSave(){
    const autoPathToSave = path.getAttribute('d');
    var newSVGId = document.getElementById("autopathsection2").children.length + 1;
    autoSVGs.push({id: newSVGId, path: autoPathToSave});
    updateAutoPathDisplay();
    clearCurrentPath();
    disableDrawing();
    exitAutoPathCreationWoutSaving();
}

function updateAutoPathDisplay() {
    if (autoSVGs.length >= 5) {
        document.getElementById("newautopathbutton").style.display = "none";
    }

    const container = document.getElementById("autopathsection2");
    container.innerHTML = "";

    autoSVGs.forEach(auto => {
        const autodisplaycontainer = document.createElement("div");
        autodisplaycontainer.className = "autodisplaycontainer";
        autodisplaycontainer.setAttribute("onclick", "displayAutoBig(this)");
        autodisplaycontainer.dataset.autoid = auto.id;
        autodisplaycontainer.style.position = "relative";
        autodisplaycontainer.style.width = "80%";
        autodisplaycontainer.style.margin = "auto";

        const img = document.createElement("img");
        img.src = "images/fieldimage.png";
        img.style.width = "100%";
        img.style.height = "auto";
        img.style.display = "block";
        img.style.position = "relative";
        img.style.pointerEvents = "none";
        img.style.zIndex = "1";

        const overlayDiv = document.createElement("div");
        overlayDiv.style.position = "absolute";
        overlayDiv.style.top = "0";
        overlayDiv.style.left = "0";
        overlayDiv.style.width = "100%";
        overlayDiv.style.height = "100%";
        overlayDiv.style.pointerEvents = "none";
        overlayDiv.style.zIndex = "2";

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 300 300");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.display = "block";
        svg.style.position = "absolute";
        svg.style.top = "0";
        svg.style.left = "0";

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", auto.path);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "white");
        path.setAttribute("stroke-width", "2");

        svg.appendChild(path);
        overlayDiv.appendChild(svg);

        autodisplaycontainer.appendChild(img);
        autodisplaycontainer.appendChild(overlayDiv);

        container.appendChild(autodisplaycontainer);
    });
}



function showAutoEditButtons(){
    if(!lockNoUse){
        document.getElementById("autodisplayclearbutton").style.display = "block";
        document.getElementById("autodisplaysaveandexitbutton").style.display = "block";
    }
}

function hideAutoEditButtons(){
    document.getElementById("autodisplayclearbutton").style.display = "none";
    document.getElementById("autodisplaysaveandexitbutton").style.display = "none";
}

function displayAutoBig(element) {
    const selectedId = parseInt(element.dataset.autoid, 10);
    const autoPathToDrawBig = autoSVGs.find(item => item.id === selectedId);

    console.log(`Attempted to display auto big using these pieces of data: ${selectedId} as the selected id, and ${autoPathToDrawBig} as the specific auto path`)

    if (!autoPathToDrawBig) {
        console.warn(`No autoSVG found with id ${selectedId}`);
        return;
    }

    disableDrawing();

    document.getElementById("autopathsection1").style.display = "none";
    document.getElementById("autopathsection2").style.display = "none";
    document.getElementById("autopathsection3").style.display = "flex";
    document.getElementById("autopathsection4").style.display = "flex";

    document.getElementById("autodisplayclearbutton").style.display = "none";
    document.getElementById("autodisplaysaveandexitbutton").style.display = "none";
    document.getElementById("autodisplayexitbutton").setAttribute("onclick", "exitFromDisplayAutoBig()");

    path.setAttribute("d", autoPathToDrawBig.path);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "white");
    path.setAttribute("stroke-width", "2");

    points = [];
}

function exitFromDisplayAutoBig(){
    document.getElementById("autodisplayexitbutton").setAttribute("onclick", "exitAutoPathCreationWoutSaving()");
    document.getElementById("autodisplayclearbutton").style.display = "block";
    document.getElementById("autodisplaysaveandexitbutton").style.display = "block";
    clearCurrentPath();
    document.getElementById("autopathsection1").style.display = "flex";
    document.getElementById("autopathsection2").style.display = "flex";
    document.getElementById("autopathsection3").style.display = "none";
    document.getElementById("autopathsection4").style.display = "none";
}

function enableDrawing() {
	if (!drawingEnabled) {
		if(!lockNoUse){
            svg.addEventListener('click', handlePointer);
            svg.addEventListener('touchstart', handlePointer);
            drawingEnabled = true;
        }
	}
}

function disableDrawing() {
	if (drawingEnabled) {
		svg.removeEventListener('click', handlePointer);
		svg.removeEventListener('touchstart', handlePointer);
		drawingEnabled = false;
	}
}

async function savePrescoutData() {
	const notes = document.getElementById("notesinput").value;
	const strategy = document.getElementById("strategyinput").value;
	const ability1 = document.getElementById("ability1input").checked;
	const ability2 = document.getElementById("ability2input").checked;
	const ability3 = document.getElementById("ability3input").value;

	const teamData = {
		notes: notes,
		autosvg: autoSVGs,
		ability1: ability1,
		ability2: ability2,
		ability3: ability3,
		strategy: strategy,
		finalized: 1
	};

	const updatePayload = {
		[currentPrescoutTeam]: teamData
	};

	const { data, error } = await supabaseClient.rpc("update_prescout_for_team", {
		group_id_input: groupId,
		team_json: updatePayload
	});

	if (error) {
		console.error("Error updating prescout:", error);
		alert("Failed to save prescout data.");
		return false;
	}

	alert("Prescout data saved successfully.");
    goBackFromTeamPagePreScout();
	return true;
}

var preScoutPulledData;

async function loadPrescoutForTeam() {
	const { data, error } = await supabaseClient
		.rpc('get_prescout_for_team', {
			group_id_input: groupId,
			team_number_input: currentPrescoutTeam.toString()
		});

	if (error) {
		console.error("Failed to load prescout data:", error);
		return;
	}

	preScoutPulledData = data;

	if (!data) {
		unlockAndClearPrescoutInputs();
		autoSVGs = null;
		updateAutoPathDisplay();
		return;
	}

	autoSVGs = Array.isArray(data.autosvg) ? data.autosvg : null;
	updateAutoPathDisplay();

	if (data.finalized === 1) {
		lockAndSetPrescoutInputs(data);
	} else {
		unlockAndClearPrescoutInputs();
		document.getElementById("ability1input").checked = data.ability1 === true;
		document.getElementById("ability2input").checked = data.ability2 === true;
		document.getElementById("ability3input").value = data.ability3 ?? "";
		document.getElementById("strategyinput").value = data.strategy ?? "";
		document.getElementById("notesinput").value = data.notes ?? "";

		lockFinalized = false;
		lockNoUse = false;
	}
}

function unlockAndClearPrescoutInputs() {
	document.getElementById("ability1input").checked = false;
	document.getElementById("ability2input").checked = false;
	document.getElementById("ability3input").value = "";
	document.getElementById("strategyinput").value = "";
	document.getElementById("notesinput").value = "";
    document.getElementById("prescoutfinalsubmitbutton").style.display = "block";

	document.getElementById("ability1input").disabled = false;
	document.getElementById("ability2input").disabled = false;
	document.getElementById("ability3input").disabled = false;
	document.getElementById("strategyinput").disabled = false;
	document.getElementById("notesinput").disabled = false;

	autoSVGs = [];
	updateAutoPathDisplay();

	lockFinalized = false;
	lockNoUse = false;
}

function lockAndSetPrescoutInputs(data) {
	if (!data) return;
    document.getElementById("prescoutfinalsubmitbutton").style.display = "none";
	document.getElementById("ability1input").checked = data.ability1 === true;
	document.getElementById("ability2input").checked = data.ability2 === true;
	document.getElementById("ability3input").value = data.ability3 ?? "";
	document.getElementById("strategyinput").value = data.strategy ?? "";
	document.getElementById("notesinput").value = data.notes ?? "";

	document.getElementById("ability1input").disabled = true;
	document.getElementById("ability2input").disabled = true;
	document.getElementById("ability3input").disabled = true;
	document.getElementById("strategyinput").disabled = true;
	document.getElementById("notesinput").disabled = true;

	lockFinalized = true;
	lockNoUse = true;
}

async function updateFinalizedStatusInTable() {
    try {
        const { data: finalizedData, error } = await supabaseClient.rpc('get_finalized_list');

        if (error) {
            console.error('RPC error:', error.message);
            return;
        }

        finalizedData.sort((a, b) => parseInt(a.teamnum, 10) - parseInt(b.teamnum, 10));

        const finalizedMap = new Map();
        finalizedData.forEach(entry => {
            finalizedMap.set(entry.teamnum.toString(), entry.finalized === 1);
        });

        const tbody = document.getElementById("prescoutteamstbody");
        if (!tbody) {
            console.warn('Table body element "prescoutteamstbody" not found.');
            return;
        }

        Array.from(tbody.rows).forEach(row => {
            const teamNumText = row.cells[0]?.textContent || "";
            const teamNum = teamNumText.split(" ")[0];

            const isFinalized = finalizedMap.get(teamNum) || false;

            row.cells[1].innerHTML = isFinalized
                ? '<img style="width: 80%; height: auto;" src="images/checkmark.png">'
                : '';
        });

    } catch (error) {
        console.error('Failed to update finalized status:', error);
    }
}
