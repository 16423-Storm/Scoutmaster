const SUPABASE_URL = 'https://tgptsuzheleshmtesbcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncHRzdXpoZWxlc2htdGVzYmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4ODA3NDQsImV4cCI6MjA3MDQ1Njc0NH0.pNTxZbSUeyATBlssBIZDrTyn1E2fr8bvCQ4mP3OQ-JM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const savedGroupId = localStorage.getItem('groupId');
const savedSupabaseUrl = localStorage.getItem('supabaseUrl');

var groupId = savedGroupId;
var onContinueAfterWarning;
var groupMembers;
var invitedMembers;

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
    localStorage.setItem('supabaseUrl', SUPABASE_URL);
    loadcookies();
    useSessionData();
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
            document.getElementById("regviewbodycontainer").style.display = "none";
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

function goToAccountPage(){
    window.location.href = "accountmanage.html"
}


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

document.getElementById("compsearchinput").addEventListener("input", async function() {
    const compSearchInputVal = this.value.toLowerCase();
    const container = document.getElementById("comptabcontainer");

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
    if (!event) {
        console.warn("No eventKey set");
        return;
    }
    if (!groupId) {
        console.warn("No groupId set");
        return;
    }

    const { data: groupData, error: groupError } = await supabaseClient
        .from('group')
        .select('competition')
        .eq('id', groupId)
        .maybeSingle();

    if (groupError) {
        console.error('Error fetching invited users:', groupError);
        statusPopUp('Error fetching invited users:', groupError);
        return;
    }

    if(!groupData){
        setScoutedCompetition();
    }

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

    statusPopUp("Successfully scouting new competition!")
    document.getElementById("compinfo").textContent = `Currently Scouting: ${eventName}`
}