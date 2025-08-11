const SUPABASE_URL = 'https://tgptsuzheleshmtesbcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncHRzdXpoZWxlc2htdGVzYmN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4ODA3NDQsImV4cCI6MjA3MDQ1Njc0NH0.pNTxZbSUeyATBlssBIZDrTyn1E2fr8bvCQ4mP3OQ-JM';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

//dark mode toggle
function darkmodetoggle(){
    const targetBody = document.body;
    const sunMoonImg = document.getElementById("imgToToggle");
    const accountButtonImg = document.getElementById("accountbuttonimg")
    const switchList = [document.getElementById("navdivider"), document.getElementById("reason1"), document.getElementById("reason2"), document.getElementById("reason3"), document.getElementById("reason4"), document.getElementById("signupbutton"), document.getElementById("newgroupbutton"), document.getElementById("existinggroupbutton"), document.getElementById("creategroupbutton")]

    targetBody.classList.toggle("darkmode");
    if(targetBody.classList.contains("darkmode")){
        document.cookie = "darklight=dark; path=/; max-age=31536000; SameSite=Lax; Secure";
        sunMoonImg.src = "images/sun.png";
        accountButtonImg.src = "images/accountwhite.png"
        switchList.forEach(targetElement =>{
            targetElement.classList.add(targetElement.id+"dark")
            targetElement.classList.remove(targetElement.id)
        })
    }else{
        document.cookie = "darklight=light; path=/; max-age=31536000; SameSite=Lax; Secure";
        sunMoonImg.src = "images/moon.png";
        accountButtonImg.src = "images/accountblack.png"
        switchList.forEach(targetElement =>{
            targetElement.classList.remove(targetElement.id+"dark")
            targetElement.classList.add(targetElement.id)
        })
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

    if(theme == "dark"){
        darkmodetoggle();
    }
}

window.onload = function(){
    loadcookies();
    useSessionData();
}

// button to go to login page
function goToLogIn(){
    window.location.href = "signup.html"
}

// check is user is already logged in or not
function useSessionData(){
    isUserLoggedIn().then((isLoggedIn)=>{
        if(isLoggedIn){
            alert("logged in");
            document.getElementById("signedoutmainbody").style.display = "none";
            document.getElementById("signedinmainbody").style.display = "block";
            document.getElementById("accountbutton").style.display = "block";
            checkGroupMembership();
        }else{
            alert("logged out");
        }
    })
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
        alert("in a group")
        // user is in a group
        document.getElementById("ingroupmainbody").style.display = "block";
        document.getElementById("notingroupmainbody").style.display = "none";
    } else {
        alert("not in a group")
        // user is not in a group
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

}

async function createGroup() {
  const groupName = document.getElementById('groupnameinput').value;

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  const userId = session.user.id;

  let maxRetries = 3;
  let attempt = 0;
  let groupCreated = false;

  while (attempt < maxRetries && !groupCreated) {
    attempt++;

    const { data: maxData, error: maxError } = await supabaseClient
      .from('groups')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (maxError) {
      console.error("Failed to fetch max group ID:", maxError.message);
      return;
    }

    const newId = maxData.length > 0 ? maxData[0].id + 1 : 1;

    const groupData = {
      id: newId,
      group_name: groupName,
      made: new Date().toISOString(),
      competitions: {},
      members: [userId],
    };

    const { error: insertError } = await supabaseClient
      .from('group')
      .insert(groupData);

    if (!insertError) {
      alert(`Group "${groupName}" created with ID ${newId}`);
      groupCreated = true;
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

