const SUPABASE_URL = 'https://tgptsuzheleshmtesbcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncHRzdXpoZWxlc2htdGVzYmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4ODA3NDQsImV4cCI6MjA3MDQ1Njc0NH0.pNTxZbSUeyATBlssBIZDrTyn1E2fr8bvCQ4mP3OQ-JM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var groupId;

var onContinueAfterWarning;

var groupMembers;

function popUpWarning(message, onContinue){
    document.getElementById("warningpopup").style.display = "block";
    document.getElementById("warningmessage").textContent = message;

    onContinueAfterWarning = onContinue;
}

function popUpCancel(){
    document.getElementById("warningpopup").style.display = "none";
    onContinueAfterWarning = null;
}

function popUpContinue(){
    if (typeof onContinueAfterWarning === "function") {
        onContinueAfterWarning();
    }
    document.getElementById("warningpopup").style.display = "none";
    onContinueAfterWarning = null;
}

//dark mode toggle
function darkmodetoggle(){
    const targetBody = document.body;
    const sunMoonImg = document.getElementById("imgToToggle");
    const accountButtonImg = document.getElementById("accountbuttonimg")
    const switchList = [
        document.getElementById("navdivider"),
        document.getElementById("reason1"),
        document.getElementById("reason2"),
        document.getElementById("reason3"),
        document.getElementById("reason4"),
        document.getElementById("signupbutton"),
        document.getElementById("newgroupbutton"),
        document.getElementById("existinggroupbutton"),
        document.getElementById("creategroupbutton"),
        document.getElementById("memberlistcontainer"),
        document.getElementById("competitionfocusselectcontainer"),
        document.getElementById("updateadminbutton")
    ];

    targetBody.classList.toggle("darkmode");
    if(targetBody.classList.contains("darkmode")){
        document.cookie = "darklight=dark; path=/; max-age=31536000; SameSite=Lax; Secure";
        sunMoonImg.src = "images/sun.png";
        accountButtonImg.src = "images/accountwhite.png"
        switchList.forEach(targetElement =>{
            targetElement.classList.add(targetElement.id+"dark")
            targetElement.classList.remove(targetElement.id)
        });
    } else {
        document.cookie = "darklight=light; path=/; max-age=31536000; SameSite=Lax; Secure";
        sunMoonImg.src = "images/moon.png";
        accountButtonImg.src = "images/accountblack.png"
        switchList.forEach(targetElement =>{
            targetElement.classList.remove(targetElement.id+"dark")
            targetElement.classList.add(targetElement.id)
        });
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
        alert("logged in");
        document.getElementById("signedoutmainbody").style.display = "none";
        document.getElementById("signedinmainbody").style.display = "block";
        document.getElementById("accountbutton").style.display = "block";
        checkGroupMembership();
    } else {
        alert("logged out");
        // Probably want to show signedoutmainbody here? (not in your original but might be good)
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

            alert("Your group was deleted. Please join or create a new group.");
            document.getElementById("ingroupmainbody").style.display = "none";
            document.getElementById("notingroupmainbody").style.display = "block";
            return;
        }

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

            alert("You were removed from the group. Please join again or contact an admin.");
            document.getElementById("ingroupmainbody").style.display = "none";
            document.getElementById("notingroupmainbody").style.display = "block";
            return;
        }

        const isAdmin = member?.isAdmin === true;

        document.getElementById("ingroupmainbody").style.display = "block";
        document.getElementById("notingroupmainbody").style.display = "none";

        if (isAdmin) {
            document.getElementById("adminviewbodycontainer").style.display = "flex";
            document.getElementById("regviewbodycontainer").style.display = "none";
            loadMembers();
        } else {
            document.getElementById("adminviewbodycontainer").style.display = "none";
            document.getElementById("regviewbodycontainer").style.display = "flex";
        }
    } else {
        alert("not in a group");
        document.getElementById("ingroupmainbody").style.display = "none";
        document.getElementById("notingroupmainbody").style.display = "block";
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
    document.getElementById("creategroupcontainer").style.display = "block";
}

function existingButtonClick(){
    // TODO: Implement existing group join flow if needed
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
            competitions: {},
            members: JSON.stringify(membersArray)
        };

        const { error: insertError } = await supabaseClient
            .from('group')
            .insert(groupData);

        if (!insertError) {
            alert(`Group "${groupName}" created with ID ${newId}`);

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
        alert("Failed to create group. Please try again.");
    }
}

async function loadMembers() {
    if (!groupId) {
        console.warn("No groupId set");
        return;
    }

    const { data: groupData, error: groupError } = await supabaseClient
        .from('group')
        .select('members')
        .eq('id', groupId)
        .maybeSingle();

    if (groupError || !groupData) {
        console.error('Error fetching group members:', groupError);
        return;
    }

    groupMembers = groupData.members || [];

    const tbody = document.getElementById("memberlisttbody");
    tbody.innerHTML = "";  // Clear existing rows

    groupMembers.forEach(member => {
        const newRow = document.createElement("tr");

        const cellEmail = document.createElement("td");
        cellEmail.textContent = member.email;
        newRow.appendChild(cellEmail);

        const cellCheckbox = document.createElement("td");
        const adminCheckbox = document.createElement("input");
        adminCheckbox.type = "checkbox";
        adminCheckbox.checked = !!member.isAdmin;

        if(!!member.isAdmin){
            const firstCell = newRow.querySelector('td');
            if (firstCell) {
                firstCell.style.color = 'red';
            }
        }

        const changedStar = document.createElement("span");
        changedStar.textContent = "*";
        changedStar.style.border = "none";
        changedStar.style.outline = "none";
        changedStar.style.marginLeft = "5px";
        changedStar.style.display = "none"; 

        adminCheckbox.addEventListener("change", () => {
            changedStar.style.display = "inline";
        });

        cellCheckbox.appendChild(adminCheckbox);
        cellCheckbox.appendChild(changedStar);
        newRow.appendChild(cellCheckbox);

        tbody.appendChild(newRow);
    });

}

async function adminUpdate() {
    alert("admin change attempted")
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

  alert(JSON.stringify(groupMembers, null, 2));

  const { error: updateError } = await supabaseClient
    .from('group')
    .update({ members: groupMembers })
    .eq('id', groupId);

  if (updateError) {
    console.error('Failed to update members in group:', updateError);
  } else {
    alert('Admin changes saved!');
    checkGroupMembership();
  }
}
