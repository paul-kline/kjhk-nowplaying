let clocks = document.getElementsByClassName("clock");
console.log("version", "1.2.1");
function startTime() {
  Array.prototype.forEach.call(clocks, function(el) {
    el.innerHTML = new Date().toLocaleTimeString();
  });

  setTimeout(startTime, 1000);
}

startTime();

var app = new Vue({
  el: "#app",
  data: {
    message: "Hello Vue!",
    songdat: {},
    albumurl: "",
    spotifyAlbumUrl: "#",
    spotifyArtistUrl: "#",
    linkTarget: ""
  },
  computed: {
    calclocal: function() {
      if (this.songdat == undefined) {
        return "";
      }
      console.log("here is songdat:", this.songdat);
      let d = new Date(this.songdat.timestamp.replace(" ", "T"));
      return new Date(
        d.getTime() - d.getTimezoneOffset() * 60000
      ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  },
  created() {
    console.log("about to axios:");
    //update every 10 seconds:
    recur_updateSong(this);

    function recur_updateSong(obj) {
      updateSong(obj);
      setTimeout(() => {
        recur_updateSong(obj);
      }, 10000);
    }
    function updateSong(obj) {
      axios.get("https://kjhk.org/nowplaying.php").then(json => {
        // console.log("received data:", json.data);
        //modified api to handle last X songs, so check if array and just get first:
        if (json.data instanceof Array) {
          json.data = json.data[0];
        }
        if (obj.songdat.timestamp !== json.data.timestamp) {
          obj.songdat = json.data;
          setTitle(obj.songdat.song + " · " + obj.songdat.artist);
          console.log("updating song");
          console.log("calling with:", obj.songdat.artist, obj.songdat.album);
          document.getElementsByTagName;
          axios
            .get("http://kjhkstream.org:3210/albumart", {
              params: {
                artist: obj.songdat.artist,
                album: obj.songdat.album
              }
            })
            .then(data => {
              console.log(data.data);
              let albuminfo;
              let imageurl;

              try {
                app.linkTarget = "_blank";
                console.log(albuminfo);
                albuminfo = data.data.albums.items[0];
                imageurl = albuminfo.images[0].url; //zero is biggest.
                app.spotifyAlbumUrl = albuminfo.external_urls.spotify;
                app.spotifyArtistUrl =
                  albuminfo.artists[0].external_urls.spotify;
              } catch (e) {
                console.log("no album art received:", e);
                imageurl = "";
                app.spotifyAlbumUrl = "#";
                app.spotifyArtistUrl = "#";
                app.linkTarget = "";
              }

              app.albumurl = imageurl;
              console.log(app);
            })
            .catch(e => {
              console.log("uhoh. I caught something: ", e);
            });
        }
      });
    }
  }
});

function setTitle(str) {
  document.getElementsByTagName("title")[0].innerHTML = replaceTag(str).replace(
    "Â",
    ""
  );
  console.log(
    "str was",
    str,
    "title set to:",
    replaceTag(str).replace("Â", "")
  );
}
let tagsToReplace = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;"
};

function replaceTag(tag) {
  return tagsToReplace[tag] || tag;
}

function safe_tags_replace(str) {
  return str.replace(/[&<>]/g, replaceTag);
}
