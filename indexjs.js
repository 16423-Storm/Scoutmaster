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
var currentMatchKey;
var currentR1;
var currentR2;
var currentB1;
var currentB2;
var chartScale = 0.7;

// Worth variables (adjust per game rules)
const AUTO_ELEMENT_ONE_WORTH = 3;
const AUTO_ELEMENT_TWO_WORTH = 1;
const AUTO_ELEMENT_THREE_WORTH = 2;
const AUTO_ELEMENT_FIVE_WORTH = 3;

const TELEOP_ELEMENT_ONE_WORTH = 3;
const TELEOP_ELEMENT_TWO_WORTH = 1;
const TELEOP_ELEMENT_THREE_WORTH = 2;
const TELEOP_ELEMENT_FOUR_WORTH = 1;
const TELEOP_ELEMENT_FIVE_WORTH = 5;

console.log(
    "%c⚠️ WARNING! ⚠️\n" +
    "This console is intended for developers and developers ONLY.\n" +
    "Do NOT type anything in here, or you risk getting your entire group banned\n" +
    "It could expose your data or compromise your account.",
    "color: red; font-size: 16px; font-weight: bold;"
);


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

	const { data: usergroupCheck, error: usergroupError } = await supabaseClient
		.from('usergroup')
		.select('*')
		.eq('id', userId)
		.eq('group_id', groupToJoinId)
		.single();

	if (usergroupError || !usergroupCheck) {
		console.error("User not authorized to join this group's channel.");
		return;
	}

	const groupChannelName = `chat-room-${groupToJoinId}`;
	const channel = supabaseClient.channel(groupChannelName, {
		config: {
			broadcast: { self: true }
		}
	});

	await channel.subscribe();

	channel.on('broadcast', { event: 'new-message' }, (payload) => {
		console.log(`[${groupChannelName}] Received:`, payload.payload.text);
        handleNewMessage(payload.payload);
	});

}


async function inviteUser() {
    const inputVal = document.getElementById("invitepopupinput").value.trim().toLowerCase();

    if (!inputVal) {
        statusPopUp("Please enter a valid email.");
        return;
    }

    if(!inputVal.includes("@")){
        console.error("Not a valid email, does not contain '@'");
        statusPopUp("Not a valid email, does not contain '@'");
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
        emailCell.classList.add("memberlistemail");
        emailCell.textContent = email;
        emailCell.onclick = function() {
            popUpWarning(
            "Clicking continue will remove this member from your invite list, are you 100% sure you want to continue?", 
            () => removeInvite(this)
            );
        };
        newRow.appendChild(emailCell);
        invitedTbody.appendChild(newRow);
    });

}

async function removeInvite(emailCell) {
    const { data: groupData, error: groupError } = await supabaseClient
        .from('group')
        .select('invited')
        .eq('id', groupId)
        .maybeSingle();

    if (groupError || !groupData) {
        errorHandleText.textContent = "Failed to load group data.";
        errorHandleText.style.color = "red";
        console.error(groupError);
        return;
    }

    const invitedArray = Array.isArray(groupData.invited) ? groupData.invited : [];
    const updatedInvited = invitedArray.filter(e => e !== emailCell.textContent);

    const { error: invitedUpdateError } = await supabaseClient
        .from('group')
        .update({ invited: updatedInvited })
        .eq('id', groupId);

    if (invitedUpdateError) {
        console.error("Failed to remove user from invited list:", invitedUpdateError.message);
    }

    emailCell.parentElement.remove();
    statusPopUp("Successfully removed email from invite list");
}



//dark theme toggle
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

async function actualLoad(){
    console.log("Loading onload functions now.");
    loadcookies();
    await useSessionData();
    loadStartingComp();  
    document.body.classList.remove("lock-scroll");
    document.getElementById("blackout").style.display = "none";
    document.getElementById("loadingimgcontainer").style.display = "none";
    localStorage.setItem('supabaseUrl', SUPABASE_URL);
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
        await checkGroupMembership();
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

        isAdminized = isAdmin;

        document.getElementById("ingroupmainbody").style.display = "block";
        document.getElementById("notingroupmainbody").style.display = "none";
        document.getElementById('notingroupbuttons').style.display = "none";

        if (isAdmin) {
            document.getElementById("adminviewbodycontainer").style.display = "flex";
            document.getElementById("regviewbodycontainer").style.display = "flex";
            document.getElementById("groupidtext").textContent = `Group ID: ${groupId}`
            loadMembers();
            loadInvitedUsers();
        } else {
            document.getElementById("adminviewbodycontainer").style.display = "none";
            document.getElementById("regviewbodycontainer").style.display = "flex";
        }

        const groupChannelName = `chat-room-${groupId}`;

        if (!window.joinedChannels[groupChannelName]) {
            const channel = supabaseClient.channel(groupChannelName, {
                config: { broadcast: { self: true } }
            });

            try {
                await channel.subscribe();
                channel.on('broadcast', { event: 'new-message' }, (payload) => {
                    console.log(`[${groupChannelName}] Received:`, payload.payload.text);
                    handleNewMessage(payload.payload);
                });
                window.joinedChannels[groupChannelName] = channel;

                console.log(`Subscribed to realtime channel: ${groupChannelName}`);
            } catch (error) {
                console.error("Failed to subscribe to realtime channel:", error);
            }
        } else {
            console.log(`Already subscribed to channel: ${groupChannelName}`);
        }

    } else {
        document.getElementById("ingroupmainbody").style.display = "none";
        document.getElementById("notingroupmainbody").style.display = "block";
        document.getElementById('notingroupbuttons').style.display = "block";
    }
}

window.joinedChannels = window.joinedChannels || {};

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

			const groupChannelName = `chat-room-${newId}`;
			const channel = supabaseClient.channel(groupChannelName, {
				config: {
					broadcast: { self: true }
				}
			});

			await channel.subscribe();

			await channel.send({
				type: 'broadcast',
				event: 'new-message',
				payload: { text: `Group "${groupName}" has been created.` }
			});

			channel.on('broadcast', { event: 'new-message' }, (payload) => {
				console.log(`[${groupChannelName}] Received:`, payload.payload.text);
                handleNewMessage(payload.payload);
			});

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

var previousDivIdsVisibleAccount = [];

function goToAccountPage(){
    previousDivIdsVisibleAccount = Array.from(document.getElementById("signedinmainbody").children)
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

    previousDivIdsVisibleAccount.forEach(div =>{
        document.getElementById(div.id).style.display = "none";
    });
}

function goBackFromAccount(){
    previousDivIdsVisibleAccount.forEach(div =>{
        document.getElementById(div.id).style.display = div.display;
    });
    document.getElementById("accountmanagebody").style.display = "none";
}



//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// ACCOUNT MANAGEMENT BEFORE HERE
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!






var previousDivIdsVisible = [];


async function logOut() {
    const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
    
    if (error) {
        console.error('Error logging out:', error.message);
    } else {
        console.log('Successfully logged out from local session.');
        window.location.href = "index.html";
        localStorage.clear();
        location.reload();
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
        localStorage.clear();
        checkGroupMembership(); 
        location.reload();
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

        statusPopUp("Removed member from group successfully!");

        checkGroupMembership(); 
    }
}



async function deleteAccount() {
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
        await leaveGroup();
        await logOut();
        localStorage.clear();
        window.location.href = "index.html";
        location.reload();
        
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
    console.log("Started attempt to load starting comp");
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
        document.getElementById("compsearchinput").value = "";
        document.getElementById("compsearchinput").dispatchEvent(new Event('input'));
        document.getElementById("headercompetitionname").textContent = `${event.event_name}`;
        document.getElementById("competitionnameinprescoutlist").textContent = event.event_name;
        document.getElementById("competitionnameinmatchscoutlist").textContent = event.event_name;
    } catch (error) {
        console.error('Failed to load event:', error);
        window.location.reload();
    }
}



document.getElementById("compsearchinput").addEventListener("input", async function() {
    const compSearchInputVal = this.value.toLowerCase();
    const container = document.getElementById("comptabcontainer");

    if(compSearchInputVal.trim() === ""){
        container.innerHTML = '';
        return;
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

    currentEventKey = eventKey;

    statusPopUp("Successfully scouting new competition!");
    document.getElementById("compinfo").textContent = `Currently Scouting: ${eventName}`;
    document.getElementById("competitionnameinmatchscoutlist").textContent = eventName;
    document.getElementById("headercompetitionname").textContent = `${eventName}`;
    document.getElementById("competitionnameinprescoutlist").textContent = eventName;
    document.getElementById("compsearchinput").value = "";
    document.getElementById("compsearchinput").dispatchEvent(new Event('input'));
    clearAllLocalPrescoutData();
    deletePrescoutDatabase();
    deleteMatchDatabase();
    deleteTeamDatabase();
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
    getMatchList();
}

function goBackFromMatchScout(){
    cancelRendering();
    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = div.display;
    });
    document.getElementById("matchscoutbodycontainer").style.display = "none";
}

var allianceTeamsList = [];

async function showAllianceSelection(){
    var numOfAlliances;

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

        if(teams.length < 11){
            numOfAlliances = 2;
        }else if(teams.length > 12 && teams.length < 21){
            numOfAlliances = 4;
        }else if(teams.length > 20 && teams.length < 41){
            numOfAlliances = 6;
        }else if(teams.length > 40){
            numOfAlliances = 8;
        }else{
            numOfAlliances = 2;
        }

        allianceTeamsList = teams.map(team => team.team_key);


        const allInCon = document.getElementById("allianceinfocontainer");
        allInCon.innerHTML = '';
        var num = 0;
        while(num < numOfAlliances){
            var allianceNum = num + 1;
            // if(currentEventKey === "2425-CMP-HOU1" || currentEventKey === "2425-CMP-HOU2" || currentEventKey === "2425-CMP-HOU3" || currentEventKey === "2425-CMP-HOU4"){
            //     allInCon.innerHTML += `
            //     <div class="allianceinfosubcontainer">
            //         <p class="generaltext">Alliance ${allianceNum}</p>
            //         <div style="flex-direction: row; display: flex;align-items: center;justify-content: center;">
            //             <input class="allianceinput" id="allianceinput-${allianceNum}-zero">
            //             <button class="alliancesubmitbutton" data-alliance="${allianceNum}" data-pick="zero" onclick="sendAlliance(this)">✔️</button>
            //         </div>
            //         <div style="flex-direction: row; display: flex;align-items: center;justify-content: center;">
            //             <input class="allianceinput" id="allianceinput-${allianceNum}-one">
            //             <button class="alliancesubmitbutton" data-alliance="${allianceNum}" data-pick="one" onclick="sendAlliance(this)">✔️</button>
            //         </div>
            //         <div style="flex-direction: row; display: flex;align-items: center;justify-content: center;">
            //             <input class="allianceinput" id="allianceinput-${allianceNum}-two">
            //             <button class="alliancesubmitbutton" data-alliance="${allianceNum}" data-pick="two" onclick="sendAlliance(this)">✔️</button>
            //         </div>
            //     </div>
            //     `
            // }else{
            allInCon.innerHTML += `
            <div class="allianceinfosubcontainer">
                <p class="generaltext">Alliance ${allianceNum}</p>
                <div style="flex-direction: row; display: flex;align-items: center;justify-content: center;">
                    <input class="allianceinput" id="allianceinput-${allianceNum}-zero">
                    <button class="alliancesubmitbutton" data-alliance="${allianceNum}" data-pick="zero" onclick="sendAlliance(this)">✔️</button>
                </div>
                <div style="flex-direction: row; display: flex;align-items: center;justify-content: center;">
                    <input class="allianceinput" id="allianceinput-${allianceNum}-one">
                    <button class="alliancesubmitbutton" data-alliance="${allianceNum}" data-pick="one" onclick="sendAlliance(this)">✔️</button>
                </div>
            </div>
            `
            // }
            num += 1;
        }

        const tbody = document.getElementById("allianceteamtbody");
        tbody.innerHTML = '';

        const teamsWithPoints = [];

        for (const team of teams) {
            const { data: avgPoints, error: avgPointsError } = await supabaseClient.rpc('get_team_average_points', {
                group_id: groupId,
                team_key: team.team.team_number.toString()
            });

            if (avgPointsError) {
                console.error("Error loading average points:", avgPointsError);
                continue;
            }

            console.log("Average points:", avgPoints);

            teamsWithPoints.push({
                team,
                avgPoints: avgPoints !== null ? avgPoints : -Infinity
            });
        }

        teamsWithPoints.sort((a, b) => b.avgPoints - a.avgPoints);

        tbody.innerHTML = '';

        for (const { team, avgPoints } of teamsWithPoints) {
            tbody.innerHTML += `
                <tr class="prescouttablerow" onclick="goToAllianceTeamPage(this)" style="text-align: center;">
                    <td>${team.team.team_number} - ${team.team.team_name_short}</td>
                    <td>${avgPoints !== -Infinity ? avgPoints.toFixed(2) : 'N/A'}</td>
                </tr>
            `;
        }


	} catch (error) {
		console.error('Failed to load teams:', error);
        window.location.reload();
		return;
	}
    
}

async function sendAlliance(element){
    allianceNum = element.dataset.alliance;
    pickNum = element.dataset.pick;
    teamPut = document.getElementById(`allianceinput-${allianceNum}-${pickNum}`).value;

    if(!allianceTeamsList.includes(teamPut)){
        console.error("Not a valid team number");
        return;
    }

    const messageText = `${allianceNum}-${pickNum}-${teamPut}`;

    const groupChannelName = `chat-room-${groupId}`;
    const channel = window.joinedChannels[groupChannelName];

    if (!channel) {
        console.error("Not subscribed to the group channel yet.");
        return;
    }

    const message = { text: messageText }; 

    const { error } = await channel.send({
        type: 'broadcast',
        event: 'new-message',
        payload: message
    });

    if (error) {
        console.error("Failed to send message:", error);
    }


}

function handleNewMessage(message) {
    console.log("Message received: " + message.text);
    var splitUp = message.text.split("-");

    document.getElementById(`allianceinput-${splitUp[0]}-${splitUp[1]}`).value = splitUp[2];

    var teamToStrikeThrough = splitUp[2];

    const rows = document.getElementById("allianceteamtbody").children;

    for (let row of rows) {
        const cell = row.children[0];
        if (cell) {
            const teamNumberInCell = cell.textContent.trim().split(" - ")[0];
            if (teamNumberInCell === teamToStrikeThrough) {
                cell.style.textDecoration = "line-through";
                row.onclick = "";
                break;
            }
        }
    }
}

function goBackFromAllianceSelection(){
    previousDivIdsVisible.forEach(div =>{
        document.getElementById(div.id).style.display = div.display;
    });
    document.getElementById("allianceselectionbodycontainer").style.display = "none";
    allianceTeamsList = [];
}

async function goToAllianceTeamPage(element) {
    const teamNumber = element.children[0].textContent.split(" - ")[0];

    document.getElementById("teamshowallianceautooverlay").dataset.team = teamNumber;
    document.getElementById("allianceteamnumbertext").textContent = element.children[0].textContent;
    document.getElementById("allianceinfocontainer").style.display = "none";
    document.getElementById("allianceteamlist").style.display = "none";
    document.getElementById("allianceteampage").style.display = "flex";
    document.getElementById("goBackAllTheWayFromAlliance").style.display = "none";

    const { data, error } = await supabaseClient.rpc('get_team_match_data', {
        g_id: groupId,
        team_num: teamNumber
    });

    if (error) {
        console.error('RPC Error:', error);
        return;
    }

    console.log('Team Match Data:', data);

    const matchLabels = [];
    const autoElementOne = [];
    const autoElementTwo = [];
    const autoElementThree = [];
    const autoElementFive = [];
    const teleopElementOne = [];
    const teleopElementTwo = [];
    const teleopElementThree = [];
    const teleopElementFour = [];
    const teleopElementFive = [];
    const autoTotals = [];
    const teleopTotals = [];
    const overallTotals = [];

    // Extract and prepare data
    for (const matchKey in data) {
        const matchData = data[matchKey];
        const station = Object.keys(matchData)[0]; 
        const stationData = matchData[station];

        const auto = stationData.auto;
        const teleop = stationData.teleop;

        const ae1 = Number(auto.elementone);
        const ae2 = Number(auto.elementtwo);
        const ae3 = Number(auto.elementthree);
        const ae5 = Number(auto.elementfive);
        const te1 = Number(teleop.elementone);
        const te2 = Number(teleop.elementtwo);
        const te3 = Number(teleop.elementthree);
        const te4 = Number(teleop.elementfour);
        const te5 = Number(teleop.elementfive);

        const parts = matchKey.split("-");
        const label = parts.slice(-2).join("-");
        matchLabels.push(label);

        autoElementOne.push(ae1 * AUTO_ELEMENT_ONE_WORTH);
        autoElementTwo.push(ae2 * AUTO_ELEMENT_TWO_WORTH);
        autoElementThree.push(ae3 * AUTO_ELEMENT_THREE_WORTH);
        autoElementFive.push(ae3 * AUTO_ELEMENT_FIVE_WORTH);
        teleopElementOne.push(te1 * TELEOP_ELEMENT_ONE_WORTH);
        teleopElementTwo.push(te2 * TELEOP_ELEMENT_TWO_WORTH);
        teleopElementThree.push(te3 * TELEOP_ELEMENT_THREE_WORTH);
        teleopElementFour.push(te2 * TELEOP_ELEMENT_FOUR_WORTH);
        teleopElementFive.push(te3 * TELEOP_ELEMENT_FIVE_WORTH);

        const autoTotal = 
            ae1 * AUTO_ELEMENT_ONE_WORTH +
            ae2 * AUTO_ELEMENT_TWO_WORTH +
            ae3 * AUTO_ELEMENT_THREE_WORTH +
            ae5 * AUTO_ELEMENT_FIVE_WORTH;

        const teleopTotal = 
            te1 * TELEOP_ELEMENT_ONE_WORTH +
            te2 * TELEOP_ELEMENT_TWO_WORTH +
            te3 * TELEOP_ELEMENT_THREE_WORTH +
            te4 * TELEOP_ELEMENT_FOUR_WORTH +
            te5 * TELEOP_ELEMENT_FIVE_WORTH;

        const total = autoTotal + teleopTotal;

        autoTotals.push(autoTotal);
        teleopTotals.push(teleopTotal);
        overallTotals.push(total);
    }

    const destroyChart = (id) => {
        const chartCanvas = document.getElementById(id);
        if (chartCanvas && Chart.getChart(id)) {
            Chart.getChart(id).destroy();
        }
    };

    destroyChart("totalchart");
    destroyChart("autochart");
    destroyChart("teleopchart");

    // Total Chart
    new Chart(document.getElementById("totalchart").getContext("2d"), {
        type: "line",
        data: {
            labels: matchLabels,
            datasets: [
                {
                    label: "Total Points",
                    data: overallTotals,
                    borderColor: "rgba(0, 123, 255, 1)",
                    backgroundColor: "rgba(0, 123, 255, 0.1)",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Total Points - Team ${teamNumber}`,
                    font: { size: 14 * chartScale }
                },
                legend: {
                    labels: {
                        font: { size: 13 * chartScale }
                    }
                },
                tooltip: {
                    titleFont: { size: 13 * chartScale },
                    bodyFont: { size: 13 * chartScale }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 13 * chartScale } },
                    title: {
                        display: false
                    }
                },
                x: {
                    ticks: { font: { size: 13 * chartScale } },
                    title: {
                        display: true,
                        text: "Matches",
                        font: { size: 13 * chartScale }
                    }
                }
            }
        }
    });

    // Auto Chart
    new Chart(document.getElementById("autochart").getContext("2d"), {
        type: "line",
        data: {
            labels: matchLabels,
            datasets: [
                {
                    label: "Classified",
                    data: autoElementOne,
                    borderColor: "red",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Overflow",
                    data: autoElementTwo,
                    borderColor: "green",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Pattern",
                    data: autoElementThree,
                    borderColor: "blue",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Leave",
                    data: autoElementFive,
                    borderColor: "yellow",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Auto Total",
                    data: autoTotals,
                    borderColor: "purple",
                    borderDash: [5, 5],
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Auto Breakdown - Team ${teamNumber}`,
                    font: { size: 14 * chartScale }
                },
                legend: {
                    labels: {
                        font: { size: 13 * chartScale }
                    }
                },
                tooltip: {
                    titleFont: { size: 13 * chartScale },
                    bodyFont: { size: 13 * chartScale }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 13 * chartScale } },
                    title: {
                        display: false
                    }
                },
                x: {
                    ticks: { font: { size: 13 * chartScale } },
                    title: {
                        display: true,
                        text: "Matches",
                        font: { size: 13 * chartScale }
                    }
                }
            }
        }
    });

    // Teleop Chart
    new Chart(document.getElementById("teleopchart").getContext("2d"), {
        type: "line",
        data: {
            labels: matchLabels,
            datasets: [
                {
                    label: "Classified",
                    data: teleopElementOne,
                    borderColor: "orange",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Overflow",
                    data: teleopElementTwo,
                    borderColor: "teal",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Pattern",
                    data: teleopElementThree,
                    borderColor: "brown",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Depot",
                    data: teleopElementFour,
                    borderColor: "red",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Base",
                    data: teleopElementFive,
                    borderColor: "blue",
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                },
                {
                    label: "Teleop Total",
                    data: teleopTotals,
                    borderColor: "black",
                    borderDash: [5, 5],
                    tension: 0.3,
                    borderWidth: 2 * chartScale,
                    pointRadius: 3 * chartScale
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Teleop Breakdown - Team ${teamNumber}`,
                    font: { size: 14 * chartScale }
                },
                legend: {
                    labels: {
                        font: { size: 13 * chartScale }
                    }
                },
                tooltip: {
                    titleFont: { size: 13 * chartScale },
                    bodyFont: { size: 13 * chartScale }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { font: { size: 13 * chartScale } },
                    title: {
                        display: false
                    }
                },
                x: {
                    ticks: { font: { size: 13 * chartScale } },
                    title: {
                        display: true,
                        text: "Matches",
                        font: { size: 13 * chartScale }
                    }
                }
            }
        }
    });

    const { data: data2, error: error2 } = await supabaseClient.rpc('get_prescout_data_for_alliance_info', {
        group_id: groupId,
        team_number: teamNumber.toString()
    });

    if (error2) {
        console.error('Error fetching prescout info:', error2);
        return;
    }else{
        document.getElementById("candoxalliance").checked = !!data2.ability1;
        document.getElementById("candoyalliance").checked = !!data2.ability2;
        document.getElementById("autodescriptionalliance").value = data2.strategy;
        document.getElementById("notesalliance").value = data2.notes;
    }

}

var stillSameTeam = false;


async function showAutoOverlayAlliance(element){
    if(stillSameTeam){
        return;
    }else{
        const leTeamNumber = Number(element.dataset.team);

        const { data, error } = await supabaseClient.rpc('get_autosvg', {
            team_number: leTeamNumber,
            group_id: groupId
        });

        if (error) {
            console.error("Error fetching autosvg:", error);
            autoSVGs = null;
        } else if (data) {
            autoSVGs = data;
            console.log("Data for autosvgs:", data);
        } else {
            autoSVGs = null;
            console.warn("No autosvg data found for team", String(leTeamNumber));
        }

        lockNoUse = true;
        lockFinalized = true;

        await updateAutoPathDisplay();
        await showAutoOverlay();
        stillSameTeam = true;
    }
}

function goBackFromAllianceTeamPage(){
    document.getElementById("allianceinfocontainer").style.display = "flex";
    document.getElementById("allianceteamlist").style.display = "flex";
    document.getElementById("allianceteampage").style.display = "none";
    document.getElementById("goBackAllTheWayFromAlliance").style.display = "block";

    unlockAndClearPrescoutInputs();
    clearCurrentPath();
    updateAutoPathDisplay();
    lockNoUse = false;
    stillSameTeam = false;
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

			const emptyTeamsJson = {};
			for (const team of teams) {
				emptyTeamsJson[team.team.team_number.toString()] = [];
			}

			const { error: initTeamsError } = await supabaseClient.rpc('init_teams_column', {
				p_groupid: groupId,
				p_teams: emptyTeamsJson
			});

			if (initTeamsError) {
				console.error('Error initializing teams JSONB column:', initTeamsError.message);
			} else {
				console.log('Initialized teams JSONB column successfully.');
			}

			for (const team of teams) {
				const teamJsonb = {
					ability1: null,
					ability2: null,
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
						<td style="width: 20%;text-align:center;"></td>
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
						<td style="width: 20%; text-align:center;">
							${isFinalized ? '✔️' : ''}
						</td>
					</tr>
				`;
			});
		}
	} catch (error) {
		console.error('Failed to load teams:', error);
        window.location.reload();
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
        disableDrawing();
        loadPrescoutForTeam();
        hideAutoEditButtons();
        lockNoUse = true;
        lockFinalized = true;
    }else{
        unlockAndClearPrescoutInputs();
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

	const teamData = {
		notes: notes,
		autosvg: autoSVGs,
		ability1: ability1,
		ability2: ability2,
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
		statusPopUp("Failed to save prescout data.");
		return false;
	}

	statusPopUp("Prescout data saved successfully.");
    goBackFromTeamPagePreScout();
    updateFinalizedStatusInTable();

    saveTeamPrescoutLocally(currentPrescoutTeam, teamData);

	return true;
}

var preScoutPulledData;

async function loadPrescoutForTeam() {
    const dataLocal = getTeamPrescoutFromLocal(currentPrescoutTeam);

    if (dataLocal !== null && dataLocal !== undefined) {
        console.log("Data exists in localStorage:", dataLocal);
        lockAndSetPrescoutInputs(dataLocal);
        autoSVGs = Array.isArray(dataLocal.autosvg) ? dataLocal.autosvg : null;
        updateAutoPathDisplay();
    } else {
        console.log("No data found for that key in localStorage.");
        const { data, error } = await supabaseClient
            .rpc('get_prescout_for_team', {
                group_id_input: groupId,
                team_number_input: currentPrescoutTeam.toString()
            });

        if (error) {
            console.error("Failed to load prescout data:", error);
            window.location.reload();
            return;
        }

        preScoutPulledData = data;

        if (!data) {
            unlockAndClearPrescoutInputs();
            autoSVGs = null;
            updateAutoPathDisplay();
            return;
        }

        saveTeamPrescoutLocally(currentPrescoutTeam, data);

        autoSVGs = Array.isArray(data.autosvg) ? data.autosvg : null;
        updateAutoPathDisplay();

        if (data.finalized === 1) {
            lockAndSetPrescoutInputs(data);
        } else {
            unlockAndClearPrescoutInputs();
            document.getElementById("ability1input").checked = data.ability1 === true;
            document.getElementById("ability2input").checked = data.ability2 === true;
            document.getElementById("strategyinput").value = data.strategy ?? "";
            document.getElementById("notesinput").value = data.notes ?? "";

            lockFinalized = false;
            lockNoUse = false;
        }
    }
}

function unlockAndClearPrescoutInputs() {
	document.getElementById("ability1input").checked = false;
	document.getElementById("ability2input").checked = false;
	document.getElementById("strategyinput").value = "";
	document.getElementById("notesinput").value = "";
    document.getElementById("prescoutfinalsubmitbutton").style.display = "block";

	document.getElementById("ability1input").disabled = false;
	document.getElementById("ability2input").disabled = false;
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
	document.getElementById("strategyinput").value = data.strategy ?? "";
	document.getElementById("notesinput").value = data.notes ?? "";

	document.getElementById("ability1input").disabled = true;
	document.getElementById("ability2input").disabled = true;
	document.getElementById("strategyinput").disabled = true;
	document.getElementById("notesinput").disabled = true;

	lockFinalized = true;
	lockNoUse = true;
}

async function updateFinalizedStatusInTable() {
    try {
        const { data: finalizedData, error } = await supabaseClient.rpc('get_finalized_list', {
            p_groupid: groupId
        });
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
                ? '✔️'
                : '';
            row.dataset.teamIsFinalized = isFinalized.toString()
        });

    } catch (error) {
        console.error('Failed to update finalized status:', error);
    }
}

function saveTeamPrescoutLocally(teamNumber, teamData) {
    const prescoutDataToSave = JSON.parse(localStorage.getItem("prescoutData")) || {};
    prescoutDataToSave[teamNumber] = teamData;
    localStorage.setItem("prescoutData", JSON.stringify(prescoutDataToSave));
    console.log("Pulled data from local storage for prescout: "+JSON.stringify(prescoutDataToSave));
}

function getTeamPrescoutFromLocal(teamNumber) {
    const prescoutData = JSON.parse(localStorage.getItem("prescoutData")) || {};
    console.log("Pulled data from local storage for prescout: "+JSON.stringify(prescoutData));
    return prescoutData[teamNumber] || null;
}

function clearAllLocalPrescoutData() {
    localStorage.removeItem("prescoutData");
}

async function deletePrescoutDatabase() {
	const { data, error } = await supabaseClient
		.from('group')
		.update({ prescout: {} })
		.eq('id', groupId);

	if (error) {
		console.error('Error clearing prescout:', error);
	} else {
		console.log('Prescout cleared successfully:', data);
	}
}

async function deleteMatchDatabase() {
	const { data, error } = await supabaseClient
		.from('group')
		.update({ matches: {} })
		.eq('id', groupId);

	if (error) {
		console.error('Error clearing matches:', error);
	} else {
		console.log('Matches cleared successfully:', data);
	}
}

async function deleteTeamDatabase() {
	const { data, error } = await supabaseClient
		.from('group')
		.update({ teams: {} })
		.eq('id', groupId);

	if (error) {
		console.error('Error clearing teams:', error);
	} else {
		console.log('Teams cleared successfully:', data);
	}
}





//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//MATCH SCOUTING STUFF BELOW HERE
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

async function getMatchList() {
	try {
		const response = await fetch(`https://theorangealliance.org/api/event/${currentEventKey}/matches`, {
			headers: {
				'X-TOA-Key': ORANGE_API_KEY,
				'X-Application-Origin': 'scoutmaster',
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) throw new Error(`Error: ${response.status} - ${response.statusText}`);

		const matches = await response.json();
		const tbody = document.getElementById("matchtabletbody");

		tbody.innerHTML = '';

		for (let i = matches.length - 1; i >= 0; i--) {
			const parts = matches[i].match_key.toLowerCase().split('-');
			if (!parts[3] || !parts[3].startsWith('q')) {
				matches.splice(i, 1);
			}
		}

		matches.sort((a, b) => {
            const getQNumber = (m) => {
                const matchKey = m.match_key.toLowerCase();
                const match = matchKey.match(/q(\d+)/); 
                return match ? parseInt(match[1], 10) : 0;
            };

            return getQNumber(a) - getQNumber(b);
        });

		const { data: emptyData, error: emptyError } = await supabaseClient
            .rpc('check_matches_empty', { group_id: groupId });

        if (emptyError) {
            console.error('Error checking matches column:', emptyError);
        } else if (emptyData === true) {
            console.log('Matches column is empty or null. Initializing superTable...');

            const scoreTableTemplate = {
                "r1": {
                    "auto": { 
                        "elementone": "0", 
                        "elementtwo": "0", 
                        "elementthree": "0",
                        "elementfive": "0"
                    },
                    "teleop": { 
                        "elementone": "0", 
                        "elementtwo": "0", 
                        "elementthree": "0",
                        "elementfour": "0",
                        "elementfive": "0"
                    },
                    "team_number": "0000",
                    "finalized": 0
                },
                "r2": {
                    "auto": { 
                        "elementone": "0", 
                        "elementtwo": "0", 
                        "elementthree": "0",
                        "elementfive": "0"
                    },
                    "teleop": { 
                        "elementone": "0", 
                        "elementtwo": "0", 
                        "elementthree": "0",
                        "elementfour": "0",
                        "elementfive": "0"
                    },
                    "team_number": "0000",
                    "finalized": 0
                },
                "b1": {
                    "auto": { 
                        "elementone": "0", 
                        "elementtwo": "0", 
                        "elementthree": "0",
                        "elementfive": "0"
                    },
                    "teleop": { 
                        "elementone": "0", 
                        "elementtwo": "0", 
                        "elementthree": "0",
                        "elementfour": "0",
                        "elementfive": "0"
                    },
                    "team_number": "0000",
                    "finalized": 0
                },
                "b2": {
                    "auto": { 
                        "elementone": "0", 
                        "elementtwo": "0", 
                        "elementthree": "0",
                        "elementfive": "0"
                    },
                    "teleop": { 
                        "elementone": "0", 
                        "elementtwo": "0", 
                        "elementthree": "0",
                        "elementfour": "0",
                        "elementfive": "0"
                    },
                    "team_number": "0000",
                    "finalized": 0
                }
            };

            for (let i = matches.length - 1; i >= 0; i--) {
                const parts = matches[i].match_key.toLowerCase().split('-');
                if (!parts[3] || !parts[3].startsWith('q')) {
                    matches.splice(i, 1);
                }
            }

            matches.sort((a, b) => {
                const getQNumber = (m) => {
                    const matchKey = m.match_key.toLowerCase();
                    const match = matchKey.match(/q(\d+)/);
                    return match ? parseInt(match[1], 10) : 0;
                };

                return getQNumber(a) - getQNumber(b);
            });


            let superTable = {};
            matches.forEach(match => {
                superTable[match.match_key] = JSON.parse(JSON.stringify(scoreTableTemplate));
            });

            const { data, error } = await supabaseClient
                .from('group')
                .update({ matches: superTable })
                .eq('id', groupId);

            if (error) {
                console.error('Error updating matches in Supabase:', error);
            } else {
                console.log('Supabase group matches updated successfully:', data);
            }

        } else {
            console.log('Matches column already has data. Skipping initialization.');
        }

        for (let i = matches.length - 1; i >= 0; i--) {
            const parts = matches[i].match_key.toLowerCase().split('-');
            if (!parts[3] || !parts[3].startsWith('q')) {
                matches.splice(i, 1);
            }
        }

        matches.sort((a, b) => {
            const getQNumber = (m) => {
                const matchKey = m.match_key.toLowerCase();
                const match = matchKey.match(/q(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
            };

            return getQNumber(a) - getQNumber(b);
        });

        console.log('Final matches for rendering:', matches.map(m => m.match_key));
        
        tbody.innerHTML = '';

		for (const match of matches) {
            if (isCancelled) {
                console.log('Rendering cancelled due to user click.');
                tbody.innerHTML = '';
                break;
            }
			const matchNumber = match.match_name.split(" ")[1];
            console.log('Match:', match.match_key, 'participants before sort:', match.participants);
			const sortedParticipants = [...match.participants].sort((a, b) => a.station - b.station);
            console.log('Match:', match.match_key, 'participants after sort:', sortedParticipants.map(p => p.station));
			let winnerText = 'TBD';

			if (match.red_score > match.blue_score) {
				winnerText = 'RED';
			} else if (match.blue_score > match.red_score) {
				winnerText = 'BLUE';
			} else if (match.blue_score === match.red_score) {
				winnerText = 'TIE';
			}

			let color;
			if (winnerText === 'RED') {
				color = 'red';
			} else if (winnerText === 'BLUE') {
				color = 'blue';
			} else {
				color = 'black';
			}

			currentMatchKey = match.match_key;

			const { data: finalizedTeams, error: finalizedError } = await supabaseClient.rpc('get_match_teams_finalized', {
                p_group_id: groupId,
                p_match_key: match.match_key
            });

            if (finalizedError) {
                console.error('Error fetching finalized teams:', finalizedError);
            }

            const finalizedMap = new Map();
            if (finalizedTeams) {
                finalizedTeams.forEach(({ station, finalized }) => {
                    finalizedMap.set(station, finalized === 1);
                });
            }

            let r1f = false, r2f = false, b1f = false, b2f = false;

            if (finalizedTeams && finalizedTeams.length > 0) {
                const ft = finalizedTeams[0];
                r1f = ft.r1f === 1;
                r2f = ft.r2f === 1;
                b1f = ft.b1f === 1;
                b2f = ft.b2f === 1;
            }


			tbody.innerHTML += `
                <tr class="prescouttablerow" data-match-key="${match.match_key}" data-rone="${sortedParticipants[0].team_key}" data-rtwo="${sortedParticipants[1].team_key}" data-bone="${sortedParticipants[2].team_key}" data-btwo="${sortedParticipants[3].team_key}" data-r1f="${r1f}" data-r2f="${r2f}" data-b1f="${b1f}" data-b2f="${b2f}" onclick="goToMatchScoutModePage(this)">
                    <td>${matchNumber}</td>
                    <td style="color: ${color};">${winnerText.toUpperCase()}</td>
                    <td class="matchscoutredtd">${sortedParticipants[0].team_key}${r1f ? ' ✔️' : ''}</td>
                    <td class="matchscoutredtd">${sortedParticipants[1].team_key}${r2f ? ' ✔️' : ''}</td>
                    <td class="matchscoutbluetd">${sortedParticipants[2].team_key}${b1f ? ' ✔️' : ''}</td>
                    <td class="matchscoutbluetd">${sortedParticipants[3].team_key}${b2f ? ' ✔️' : ''}</td>
                </tr>
            `;

		}

        isCancelled = false;

	} catch (error) {
		console.error('Failed to load matches:', error);
        window.location.reload();
	}
}

var currentMatchKey2;

async function goToMatchScoutModePage(element) {
    cancelRendering();
    currentMatchKey2 = element.dataset.matchKey;

    scoreTable[0].r1.team_number = element.dataset.rone;
    scoreTable[0].r2.team_number = element.dataset.rtwo;
    scoreTable[0].b1.team_number = element.dataset.bone;
    scoreTable[0].b2.team_number = element.dataset.btwo;

    document.getElementById("matchteamnumberredone").textContent = element.dataset.rone;
    document.getElementById("matchteamnumberredtwo").textContent = element.dataset.rtwo;
    document.getElementById("matchteamnumberblueone").textContent = element.dataset.bone;
    document.getElementById("matchteamnumberbluetwo").textContent = element.dataset.btwo;

    document.getElementById("matchscoutmatchlist").style.display = "none";
    document.getElementById("matchscoutmodebody").style.display = "flex";
    document.getElementById("matchscoutallthewaybackbutton").style.display = "none";

    const stationMap = {
        r1: 2,
        r2: 3,
        b1: 4,
        b2: 5
    };

    const rowCells = element.children;

    for (const [station, cellIndex] of Object.entries(stationMap)) {
        const cell = rowCells[cellIndex];
        if (cell && cell.textContent.includes("✔️")) {
            await loadMatchStationData(currentMatchKey2, station);
        }
    }
}

let isCancelled = false;

function cancelRendering() {
  isCancelled = true;
}

function goBackFromMatchModeScout(){
    enableStationButtons();
    resetToAutoMode();
    getMatchList();
    scoreTable = [
        {
            "r1": {
                "auto": {
                    "elementone": "0",
                    "elementtwo": "0",
                    "elementthree": "0",
                    "elementfive": "0"
                },
                "teleop": {
                    "elementone": "0",
                    "elementtwo": "0",
                    "elementthree": "0",
                    "elementfour": "0",
                    "elementfive": "0"
                },
                "team_number":"0000",
                "finalized":0
            },
            "r2": {
                "auto": {
                    "elementone": "0",
                    "elementtwo": "0",
                    "elementthree": "0",
                    "elementfive": "0"
                },
                "teleop": {
                    "elementone": "0",
                    "elementtwo": "0",
                    "elementthree": "0",
                    "elementfour": "0",
                    "elementfive": "0"
                },
                "team_number":"0000",
                "finalized":0
            },
            "b1": {
                "auto": {
                    "elementone": "0",
                    "elementtwo": "0",
                    "elementfive": "0"
                },
                "teleop": {
                    "elementone": "0",
                    "elementtwo": "0",
                    "elementthree": "0",
                    "elementfour": "0",
                    "elementfive": "0"
                },
                "team_number":"0000",
                "finalized":0
            },
            "b2": {
                "auto": {
                    "elementone": "0",
                    "elementtwo": "0",
                    "elementthree": "0",
                    "elementfive": "0"
                },
                "teleop": {
                    "elementone": "0",
                    "elementtwo": "0",
                    "elementthree": "0",
                    "elementfour": "0",
                    "elementfive": "0"
                },
                "team_number":"0000",
                "finalized":0
            }
        }
    ];
    document.getElementById("matchscoutmatchlist").style.display = "flex";
    document.getElementById("matchscoutmodebody").style.display = "none";
    document.getElementById("matchscoutallthewaybackbutton").style.display = "block";
}

var scoreTable = [
    {
        "r1": {
            "auto": {
                "elementone": "0",
                "elementtwo": "0",
                "elementthree": "0",
                "elementfive": "0"
            },
            "teleop": {
                "elementone": "0",
                "elementtwo": "0",
                "elementthree": "0",
                "elementfour": "0",
                "elementfive": "0"
            },
            "team_number":"0000",
            "finalized":0
        },
        "r2": {
            "auto": {
                "elementone": "0",
                "elementtwo": "0",
                "elementthree": "0",
                "elementfive": "0"
            },
            "teleop": {
                "elementone": "0",
                "elementtwo": "0",
                "elementthree": "0",
                "elementfour": "0",
                "elementfive": "0"
            },
            "team_number":"0000",
            "finalized":0
        },
        "b1": {
            "auto": {
                "elementone": "0",
                "elementtwo": "0",
                "elementthree": "0",
                "elementfive": "0"
            },
            "teleop": {
                "elementone": "0",
                "elementtwo": "0",
                "elementthree": "0",
                "elementfour": "0",
                "elementfive": "0"
            },
            "team_number":"0000",
            "finalized":0
        },
        "b2": {
            "auto": {
                "elementone": "0",
                "elementtwo": "0",
                "elementthree": "0",
                "elementfive": "0"
            },
            "teleop": {
                "elementone": "0",
                "elementtwo": "0",
                "elementthree": "0",
                "elementfour": "0",
                "elementfive": "0"
            },
            "team_number":"0000",
            "finalized":0
        }
    }
];

var currentAutoStatus = true;


function changeMatchModeElement(button) {
    const station = button.dataset.station;   
    const element = button.dataset.element;  
    const action = button.dataset.action;

    console.log(station, element, action);

    if(action === "add"){
        if(currentAutoStatus){
            scoreTable[0][station]["auto"][element] = (Number(scoreTable[0][station]["auto"][element]) + 1).toString();
        }else{
            scoreTable[0][station]["teleop"][element] = (Number(scoreTable[0][station]["teleop"][element]) + 1).toString();
        }
    }else{
        if(currentAutoStatus && scoreTable[0][station]["auto"][element] !== "0"){
            scoreTable[0][station]["auto"][element] = (Number(scoreTable[0][station]["auto"][element]) - 1).toString();
        }else if(!currentAutoStatus && scoreTable[0][station]["teleop"][element] !== 0){
            scoreTable[0][station]["teleop"][element] = (Number(scoreTable[0][station]["teleop"][element]) - 1).toString();
        }
    }

    if(currentAutoStatus){
        document.getElementById(`matchscout${element}${station}`).textContent = scoreTable[0][station]["auto"][element];
    }else{
        document.getElementById(`matchscout${element}${station}`).textContent = scoreTable[0][station]["teleop"][element];
    }
}

function handleOptionsClick(button){
    const station = button.dataset.station;   
    const element = button.dataset.element;  
    const action = button.dataset.action;

    var arrayOfOtherActions = [];
    if(action === "lvl1"){
        arrayOfOtherActions.push("lvl2");
    }else if(action === "lvl2"){
        arrayOfOtherActions.push("lvl1");
    }else{
        console.log("Error with handling options buttons click");
    }

    console.log(station, element, action);

    if(Array.from(button.classList).includes("matchscoutbuttongrey")){
        arrayOfOtherActions.forEach(one =>{
            document.getElementById(`${element}${station}${one}`).classList = "matchscoutbuttongrey";
        });
        if(station === "r1"){
            if(currentAutoStatus){
                if(scoreTable[0].r1.auto.elementfive === action[3]){
                    scoreTable[0].r1.auto.elementfive = 0;
                }else{
                    scoreTable[0].r1.auto.elementfive = action[3];
                }
            }else{
                scoreTable[0].r1.teleop.elementfive = action[3];
            }
        }else if(station === "r2"){
            if(currentAutoStatus){
                scoreTable[0].r2.auto.elementfive = action[3];
            }else{
                scoreTable[0].r2.teleop.elementfive = action[3];
            }
        }else if(station === "b1"){
            if(currentAutoStatus){
                scoreTable[0].b1.auto.elementfive = action[3];
            }else{
                scoreTable[0].b1.teleop.elementfive = action[3];
            }
        }else if(station === "b2"){
            if(currentAutoStatus){
                scoreTable[0].b2.auto.elementfive = action[3];
            }else{
                scoreTable[0].b2.teleop.elementfive = action[3];
            }
        }else{
            console.log("Error with handling options buttons click");
        }
        console.log(JSON.stringify(scoreTable));
        button.classList = "matchscoutbuttonpurple";
    } else {
        button.classList = "matchscoutbuttongrey";
        if (station === "r1") {
            if (currentAutoStatus) {
                scoreTable[0].r1.auto.elementfive = "0";
            } else {
                scoreTable[0].r1.teleop.elementfive = "0";
            }
        } else if (station === "r2") {
            if (currentAutoStatus) {
                scoreTable[0].r2.auto.elementthree = "0";
            } else {
                scoreTable[0].r2.teleop.elementthree = "0";
            }
        } else if (station === "b1") {
            if (currentAutoStatus) {
                scoreTable[0].b1.auto.elementthree = "0";
            } else {
                scoreTable[0].b1.teleop.elementthree = "0";
            }
        } else if (station === "b2") {
            if (currentAutoStatus) {
                scoreTable[0].b2.auto.elementthree = "0";
            } else {
                scoreTable[0].b2.teleop.elementthree = "0";
            }
        } else {
            console.log("Error with handling options buttons click");
        }
    }

}

function flipAutoAuto(){
    currentAutoStatus = true;
    document.getElementById("flipautoautobutton").classList = "matchscoutbuttonpurple";
    document.getElementById("flipautoteleopbutton").classList = "matchscoutbuttongrey";
    console.log("Auto status flipped to: " + currentAutoStatus);

    document.querySelectorAll("#numerated4").forEach(el => el.style.display = "none");
    document.querySelectorAll("#leavebaseid").forEach(el => el.textContent = "Leave");

    document.getElementById("elementfiver1lvl1").textContent = "Yes";
    document.getElementById("elementfiver2lvl1").textContent = "Yes";
    document.getElementById("elementfiveb1lvl1").textContent = "Yes";
    document.getElementById("elementfiveb2lvl1").textContent = "Yes";

    document.getElementById("elementfiver1lvl2").style.display = "none";
    document.getElementById("elementfiver2lvl2").style.display = "none";
    document.getElementById("elementfiveb1lvl2").style.display = "none";
    document.getElementById("elementfiveb2lvl2").style.display = "none";

    const arrayOfElementThree = ["elementfiver1lvl1", "elementfiver1lvl2", "elementfiver2lvl1", "elementfiver2lvl2", "elementfiveb1lvl1", "elementfiveb1lvl2", "elementfiveb2lvl1", "elementfiveb2lvl2"];

    const arrayOfElementOnesAndTwos = ["matchscoutelementoner1","matchscoutelementtwor1","matchscoutelementthreer1","matchscoutelementoner2","matchscoutelementtwor2","matchscoutelementthreer2","matchscoutelementoneb1","matchscoutelementtwob1","matchscoutelementthreeb1","matchscoutelementoneb2","matchscoutelementtwob2","matchscoutelementthreeb2"];

    arrayOfElementOnesAndTwos.forEach(oneId =>{
        document.getElementById(oneId).textContent = "";
        console.log(oneId);
    });

    for (const station in scoreTable[0]) {
        const elementOneVal = scoreTable[0][station].auto.elementone;
        document.getElementById(`matchscoutelementone${station}`).textContent = elementOneVal;
        const elementTwoVal = scoreTable[0][station].auto.elementtwo;
        document.getElementById(`matchscoutelementtwo${station}`).textContent = elementTwoVal;
        const elementThreeVal = scoreTable[0][station].auto.elementthree;
        document.getElementById(`matchscoutelementthree${station}`).textContent = elementThreeVal;
    }

    arrayOfElementThree.forEach(oneId => {
        document.getElementById(oneId).classList = "matchscoutbuttongrey";
    });

    for (const station in scoreTable[0]) {
        const elementFiveVal = scoreTable[0][station].auto.elementfive;
        if (elementFiveVal === "0" || elementFiveVal === undefined || elementFiveVal === null) {
            console.log(`Element 5 inside of station ${station} is 0, this is not an error`);
        } else {
            const buttonId = `elementfive${station}lvl${elementFiveVal}`;
            document.getElementById(buttonId).classList = "matchscoutbuttonpurple";
        }
    }
}

function flipAutoTeleOp(){
    currentAutoStatus = false;
    document.getElementById("flipautoautobutton").classList = "matchscoutbuttongrey";
    document.getElementById("flipautoteleopbutton").classList = "matchscoutbuttonpurple";
    console.log("Auto status flipped to: " + currentAutoStatus);

    document.querySelectorAll("#numerated4").forEach(el => el.style.display = "flex");
    document.querySelectorAll("#leavebaseid").forEach(el => el.textContent = "Base");

    document.getElementById("elementfiver1lvl1").textContent = "Partial";
    document.getElementById("elementfiver2lvl1").textContent = "Partial";
    document.getElementById("elementfiveb1lvl1").textContent = "Partial";
    document.getElementById("elementfiveb2lvl1").textContent = "Partial";
    
    document.getElementById("elementfiver1lvl2").style.display = "block";
    document.getElementById("elementfiver2lvl2").style.display = "block";
    document.getElementById("elementfiveb1lvl2").style.display = "block";
    document.getElementById("elementfiveb2lvl2").style.display = "block";

    const arrayOfElementOnesAndTwos = ["matchscoutelementoner1","matchscoutelementtwor1","matchscoutelementthreer1","matchscoutelementfourr1","matchscoutelementoner2","matchscoutelementtwor2","matchscoutelementthreer2","matchscoutelementfourr2","matchscoutelementoneb1","matchscoutelementtwob1","matchscoutelementthreeb1","matchscoutelementfourb1","matchscoutelementoneb2","matchscoutelementtwob2","matchscoutelementthreeb2","matchscoutelementfourb2"];

    arrayOfElementOnesAndTwos.forEach(oneId =>{
        document.getElementById(oneId).textContent = "";
    });

    for (const station in scoreTable[0]) {
        const elementOneVal = scoreTable[0][station].teleop.elementone;
        document.getElementById(`matchscoutelementone${station}`).textContent = elementOneVal;
        const elementTwoVal = scoreTable[0][station].teleop.elementtwo;
        document.getElementById(`matchscoutelementtwo${station}`).textContent = elementTwoVal;
        const elementThreeVal = scoreTable[0][station].teleop.elementthree;
        document.getElementById(`matchscoutelementthree${station}`).textContent = elementThreeVal;
        const elementFourVal = scoreTable[0][station].teleop.elementfour;
        document.getElementById(`matchscoutelementfour${station}`).textContent = elementFourVal;
        const elementFiveVal = scoreTable[0][station].teleop.elementfive;
    }

    const arrayOfElementThree = ["elementfiver1lvl1", "elementfiver1lvl2", "elementfiver2lvl1", "elementfiver2lvl2", "elementfiveb1lvl1", "elementfiveb1lvl2", "elementfiveb2lvl1", "elementfiveb2lvl2"];

    arrayOfElementThree.forEach(oneId => {
        document.getElementById(oneId).classList = "matchscoutbuttongrey";
    });

    for (const station in scoreTable[0]) {
        const elementFiveVal = scoreTable[0][station].teleop.elementfive;
        if (elementFiveVal === "0" || elementFiveVal === undefined || elementFiveVal === null) {
            console.log(`Element 5 inside of station ${station} is 0, this is not an error`);
        } else {
            const buttonId = `elementfive${station}lvl${elementFiveVal}`;
            document.getElementById(buttonId).classList = "matchscoutbuttonpurple";
        }
    }
}

async function submitIndividualTeam(participantKey) {
	const station = participantKey;
	const stationData = scoreTable[0][station];

	if (!stationData) {
		console.error("Invalid participantKey/station:", station);
		return;
	}

	const teamKey = stationData.team_number;

	stationData.finalized = 1;

	try {
		const { data, error } = await supabaseClient.rpc('update_match_station_v3', {
            group_id: groupId,
            match_key: currentMatchKey2,
            station_key: station,
            station_data: stationData,
        });


		if (error) {
			console.error("Error updating match station:", error);
			scoreTable[0][station].finalized = 0;
			return;
		}

		console.log("Successfully updated match station:", data);
		statusPopUp("Match data submitted successfully.");
	} catch (err) {
		console.error("Unexpected error submitting match data:", err);
		statusPopUp("An unexpected error occurred.");
		scoreTable[0][station].finalized = 0;
		return;
	}

	try {
		const matchEntry = {
			match_key: currentMatchKey2,
			station: participantKey
		};

        const points = stationData.auto.elementone * AUTO_ELEMENT_ONE_WORTH + stationData.auto.elementtwo * AUTO_ELEMENT_TWO_WORTH + stationData.auto.elementthree * AUTO_ELEMENT_THREE_WORTH + stationData.teleop.elementone * TELEOP_ELEMENT_ONE_WORTH + stationData.teleop.elementtwo * TELEOP_ELEMENT_TWO_WORTH + stationData.teleop.elementthree * TELEOP_ELEMENT_THREE_WORTH;

		const { error: updateError } = await supabaseClient.rpc('update_team_matches', {
			group_id: groupId,
			team_key: teamKey,
			match_entry: matchEntry,
            new_point: points
		});

		if (updateError) {
			console.error("Error updating team matches:", updateError);
			scoreTable[0][station].finalized = 0;
			return;
		}

		console.log("Team match appended successfully to teams column.");
	} catch (err) {
		console.error("Unexpected error updating team data:", err);
		scoreTable[0][station].finalized = 0;
	}

	const localStorageKey = `matchdata_${currentMatchKey2}`;
	let matchData = localStorage.getItem(localStorageKey);
	matchData = matchData ? JSON.parse(matchData) : {};

	matchData[station] = stationData;

	localStorage.setItem(localStorageKey, JSON.stringify(matchData));
    loadMatchStationData(currentMatchKey2, station);
}




const allButtonIds = [
    "takeawayelementonebuttonr1", "putonelementoner1",
    "takeawayelementtwobuttonr1", "putonelementtwor1",
    "takeawayelementthreebuttonr1", "putonelementthreer1",
    "takeawayelementfourbuttonr1", "putonelementfourr1",
    "elementfiver1lvl1", "elementfiver1lvl2",

    "takeawayelementonebuttonr2", "putonelementoner2",
    "takeawayelementtwobuttonr2", "putonelementtwor2",
    "takeawayelementthreebuttonr2", "putonelementthreer2",
    "takeawayelementfourbuttonr2", "putonelementfourr2",
    "elementfiver2lvl1", "elementfiver2lvl2",

    "takeawayelementonebuttonb1", "putonelementoneb1",
    "takeawayelementtwobuttonb1", "putonelementtwob1",
    "takeawayelementthreebuttonb1", "putonelementthreeb1",
    "takeawayelementfourbuttonb1", "putonelementfourb1",
    "elementfiveb1lvl1", "elementfiveb1lvl2",

    "takeawayelementonebuttonb2", "putonelementoneb2",
    "takeawayelementtwobuttonb2", "putonelementtwob2",
    "takeawayelementthreebuttonb2", "putonelementthreeb2",
    "takeawayelementfourbuttonb2", "putonelementfourb2",
    "elementfiveb2lvl1", "elementfiveb2lvl2"
];

async function loadMatchStationData(matchKey, station) {
	const localStorageKey = `matchdata_${matchKey}`;
	let matchData = localStorage.getItem(localStorageKey);

	if (matchData) {
        matchData = JSON.parse(matchData);
        console.log('Loaded match data from localStorage:', matchData);
    } else {
        try {
            const { data, error } = await supabaseClient.rpc('get_match_station_data', {
                p_group_id: groupId,
                p_match_key: matchKey,
                p_station_key: station  
            });
            if (error) {
                console.error('Error fetching match data from Supabase:', error);
                return null;
            }

            let stored = JSON.parse(localStorage.getItem(localStorageKey));

            if (!stored || !Array.isArray(stored) || stored.length === 0) {
                stored = [{}];
            }

            stored[station] = data || {};

            localStorage.setItem(localStorageKey, JSON.stringify(stored));

            matchData = stored;
            console.log('Fetched match data from Supabase and saved to localStorage:', matchData);
        } catch (err) {
            console.error('Unexpected error fetching match data:', err);
            return null;
        }
    }


    if (!scoreTable[0]) scoreTable[0] = {};

    if (matchData[station]) {
        scoreTable[0][station] = matchData[station];
    }

	const stationData = matchData[station];
	if (!stationData) {
		console.warn(`No data found for station ${station} in match ${matchKey}`);
		return null;
	}

	if (stationData.finalized === 1) {
		const buttonsForStation = allButtonIds
			.filter(id => id.includes(station))
			.map(id => document.getElementById(id))
			.filter(Boolean);

		buttonsForStation.forEach(button => {
			button.disabled = true;
		});
        document.getElementById(`matchteamnumbercontainer${station}`).onclick = null;
        populateElementsFromScoreTable();
	} else {
		enableStationButtons();
	}

	return stationData;
}


function clearStationDataTable() {
  localStorage.setItem('stationdata', JSON.stringify({}));
  console.log('Cleared entire stationdata table in localStorage');
}

function populateElementsFromScoreTable() {
    const elementOnesAndTwos = [
        "matchscoutelementoner1", "matchscoutelementtwor1", "matchscoutelementthreer1", "matchscoutelementfourr1",
        "matchscoutelementoner2", "matchscoutelementtwor2", "matchscoutelementthreer2", "matchscoutelementfourr2",
        "matchscoutelementoneb1", "matchscoutelementtwob1", "matchscoutelementthreeb1", "matchscoutelementfourb1",
        "matchscoutelementoneb2", "matchscoutelementtwob2", "matchscoutelementthreeb2", "matchscoutelementfourb2"
    ];

    const elementThrees = [
        "elementfiver1lvl1", "elementfiver1lvl2",
        "elementfiver2lvl1", "elementfiver2lvl2",
        "elementfiveb1lvl1", "elementfiveb1lvl2",
        "elementfiveb2lvl1", "elementfiveb2lvl2",
    ];

    elementOnesAndTwos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "";
    });

    elementThrees.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList = "matchscoutbuttongrey";
    });

    for (const station in scoreTable[0]) {
        if (!scoreTable[0][station]) continue;

        const autoOrTeleop = currentAutoStatus ? "auto" : "teleop";
        const stationData = scoreTable[0][station][autoOrTeleop];
        if (!stationData) continue;

        const elOneId = `matchscoutelementone${station}`;
        const elOne = document.getElementById(elOneId);
        if (elOne && stationData.elementone !== undefined) {
            elOne.textContent = stationData.elementone;
        }

        const elTwoId = `matchscoutelementtwo${station}`;
        const elTwo = document.getElementById(elTwoId);
        if (elTwo && stationData.elementtwo !== undefined) {
            elTwo.textContent = stationData.elementtwo;
        }

        const elThreeId = `matchscoutelementthree${station}`;
        const elThree = document.getElementById(elThreeId);
        if (elThree && stationData.elementthree !== undefined) {
            elThree.textContent = stationData.elementthree;
        }

        const elFourId = `matchscoutelementfour${station}`;
        const elFour = document.getElementById(elFourId);
        if (elFour && stationData.elementfour !== undefined) {
            elFour.textContent = stationData.elementfour;
        }

        if (stationData.elementfive && stationData.elementfive !== "0") {
            const btnId = `elementfive${station}lvl${stationData.elementfive}`;
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.classList = "matchscoutbuttonpurple"; 
            }
        }
    }
}

function resetToAutoMode() {
    currentAutoStatus = true;

    const autoButton = document.getElementById("flipautoautobutton");
    const teleopButton = document.getElementById("flipautoteleopbutton");
    if (autoButton && teleopButton) {
        autoButton.className = "matchscoutbuttonpurple";
        teleopButton.className = "matchscoutbuttongrey";
        autoButton.disabled = false;
        teleopButton.disabled = false;
    }

    const elementOnesAndTwos = [
        "matchscoutelementoner1", "matchscoutelementtwor1", "matchscoutelementthreer1", "matchscoutelementfourr1",
        "matchscoutelementoner2", "matchscoutelementtwor2", "matchscoutelementthreer2", "matchscoutelementfourr2",
        "matchscoutelementoneb1", "matchscoutelementtwob1", "matchscoutelementthreeb1", "matchscoutelementfourb1",
        "matchscoutelementoneb2", "matchscoutelementtwob2", "matchscoutelementthreeb2", "matchscoutelementfourb2"
    ];

    elementOnesAndTwos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = "0";
    });

    const elementThrees = [
        "elementfiver1lvl1", "elementfiver1lvl2",
        "elementfiver2lvl1", "elementfiver2lvl2",
        "elementfiveb1lvl1", "elementfiveb1lvl2",
        "elementfiveb2lvl1", "elementfiveb2lvl2",
    ];

    elementThrees.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.className = "matchscoutbuttongrey";
            btn.disabled = false;
        }
    });

    const stations = ["r1", "r2", "b1", "b2"];

    for (const station of stations) {
        const stationData = scoreTable[0][station];
        if (!stationData || !stationData.auto) continue;

        stationData.auto.elementone = "0";
        stationData.auto.elementtwo = "0";
        stationData.auto.elementthree = "0";
    }
}

function enableStationButtons() {
    allButtonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) button.disabled = false;
    });
    ["r1", "r2", "b1", "b2"].forEach(station => {
        document.getElementById(`matchteamnumbercontainer${station}`).onclick = () => {
            popUpWarning(
                'Pressing continue will submit all match data for this specific team, and you will no longer be able to edit it, are you 100% sure you want to continue?',
                () => submitIndividualTeam(station)
            );
        };
    });
}