const searchBar = document.querySelector('#search-bar')
const searchForm = document.querySelector('#search-form')
const searchInput = document.querySelector('#search-input')
const useLocationButton = document.querySelector("#use-location-button")
const app = document.querySelector('#app')
let dailyWeatherHeads = app.querySelectorAll('.daily-weather-info-head')
let threeHourlyButtons;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "July", "Aug", "Sep", "Oct", "Nov", "Dec"]
const weekdays = ["Sunday", 'Monday', "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const definitions = {
	weather: {
		clearday: "Clear Day", clearnight: "Clear Night", pcloudyday: "Partly Cloudy Day", pcloudynight: "Partly Cloudy Night", mcloudyday: "Mostly Cloudy Day", mcloudynight: "Mostly Cloudy Night", cloudyday:"Cloudy Day", cloudynight:"Cloudy Night", humidday:"Humid Day", humidnight:"Humid Night", lightrainday: "Light Rain Day", lightrainnight: "Light Rain Night", oshowerday: "Occasional Shower Day", oshowernight: "Occasional Shower Night", ishowerday: "Isolated Shower Day", ishowernight: "Isolated Shower Night", lightsnowday:"Light Snow Day", lightsnownight: "Light Snow Night", rainday: "Rainy Day", rainnight: "Rainy Night", snowday: "Snowy Day", snownight: "Snowy Night", rainsnowday: "Rain Snow Day", rainsnownight: "Rain Snow Night", tsday: 'Thunder Storm Day', tsnight: 'Thunder Storm Night', 'tsrainday': 'Thunder Storm Rain Day', 'tsrainnight': 'Thunder Storm Rain Night'
	},
	cloudCover: {"1": "0%-6%","2": "6%-19%","3": "19%-31%","4": "31%-44%","5": "44%-56%","6": "56%-69%","7": "69%-81%","8": "81%-94%","9": "94%-100%"},
	wind10m: {"1":"Below 1 km/h (calm)","2":"1-12 km/h (light)","3":"12-29 km/h (moderate)","4":"29-39 km/h (fresh)","5":"39-62 km/h (strong)","6":"62-88 km/h (gale)","7":"88-117 km/h (storm)","8":"Over 117 km/h (hurricane)"}
}

const geoData = JSON.parse(localStorage.getItem('geoData'))
if(geoData){
	const {name} = geoData;
	findByName(name)
}else findByCoords();

// to toggle open/close on search bar
function searchBarToggleOpen(){
	searchBar.classList.toggle('open')
}

function handleSearchSubmit (e){
	e.preventDefault();
	const {value} = searchInput;
	if(value){
		findByName(value);
	}
}

function onSearchStart(){
	searchForm.onsubmit = ()=>false;
 	searchBar.classList.add('loading');
}
function onSearchEnd(){
	searchForm.onsubmit = handleSearchSubmit;
	searchBar.classList.remove('loading')
	searchBar.classList.remove('focused')
}


// fetched geodata with the url
 function getGeoData(url){
 	onSearchStart()
 	console.time('start')
	fetch(url)
	.then(res=>{
		if(res.ok){
			return res.json();
		}else{
			return alert("No data found for this location")
		}
	}).then(async geoData=>{
		if(geoData){

			if(Array.isArray(geoData)){
				geoData = geoData[0]
			}

			const {display_name: name} = geoData;
			const {lat, lon} = geoData;

			let toFetch = [getData(`https://eu1.locationiq.com/v1/timezone.php?key=pk.f129abed2b7d229581d6dc9f0e9e3dbe&lat=${lat}&lon=${lon}&format=json&limit=1`), getData(`https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=civil&output=json`), getData(`https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=civillight&output=json`)]

			const [timezone, civil, civillight] = await Promise.all(toFetch).then(data=>data)
			const {timezone: {offset_sec, name: timezoneName}} = timezone;
			// storing required information in localstorage for future use
			localStorage.setItem("geoData",JSON.stringify({name,lat,lon,offset_sec, timezoneName}))
			localStorage.setItem('civilWeather', JSON.stringify(civil))
			localStorage.setItem('civillightWeather', JSON.stringify(civillight))
			console.timeEnd('start')
			showWeather();
		}
		onSearchEnd()
	})
	.catch(err=>{
		onSearchEnd();
		console.log(err.message)
	})
	}

// create api url with coords
function findByCoords(){
	searchBar.classList.remove('focused')
	if(navigator.geolocation){
		navigator.geolocation.getCurrentPosition((data)=>{
			const {coords: {latitude: lat,longitude: lon}} = data;
			const url = `https://eu1.locationiq.com/v1/reverse.php?key=pk.f129abed2b7d229581d6dc9f0e9e3dbe&lat=${lat}&lon=${lon}&format=json`
			getGeoData(url)
		})
	}
}

// creates api url with name
function findByName(name){
	const url = `https://eu1.locationiq.com/v1/search.php?key=pk.f129abed2b7d229581d6dc9f0e9e3dbe&q=${name}&format=json&limit=1`;
	getGeoData(url)
}

function getLocationName(display_name){
	const locationNameArray = display_name.split(",")
	const name = locationNameArray[0]+", "+locationNameArray[locationNameArray.length-1];
	return name;
}

// to fetch data
async function getData(url){
	try{
		const res = await fetch(url)
		if(res.ok){
			const data = await res.json();
			return data;
		}
		return false;
	}
	catch(e){
		console.log(e.message)
		return false;
	}
}

// we have to add utc offset in civil weather, that is done here
function normalizeCivil(civil){
	const {init} = civil;
	const [year, month,day,hour] = [Number(init.slice(0,4)), Number(init.slice(4,6))-1, Number(init.slice(6,8)), Number(init.slice(8))]
	const initTime = new Date(year,month,day,hour,null,null,null).getTime()
	const {offset_sec} = JSON.parse(localStorage.getItem('geoData'))
	
	const normalized = civil.dataseries.map(weather=>({...weather, timepoint: initTime+(offset_sec*1000)+(weather.timepoint*3600000)}))
	return normalized;
}


// this function will return the weather data in required format
function normalizeWeather(){
	const civillight = JSON.parse(localStorage.getItem('civillightWeather'))
	const civil = JSON.parse(localStorage.getItem('civilWeather'))
	const geoData = JSON.parse(localStorage.getItem('geoData'))
	if(civillight && civil && geoData){
		let normalizedCivil = normalizeCivil(civil);
		const currentTime = getCurrentTime();
		// gives the index of current time. (api give us previous weather history which is not required here)
		const currentWeatherIndedx = normalizedCivil.findIndex(weather=>currentTime.getTime()>=weather.timepoint && currentTime.getTime() < weather.timepoint+(3*3600000));
		normalizedCivil = normalizedCivil.slice(currentWeatherIndedx)
	
		// binding daily weather with its corresponding hourly weather data
		let weather = civillight.dataseries.map(data=>{
		const weatherToday = normalizedCivil.filter(weather=>new Date(weather.timepoint).getDate() == String(data.date).slice(6));
			return {data, dataseries: weatherToday}
		})
		weather = weather.filter(day=>day.dataseries.length)
		return weather;
	}else{
		return false;
	}
}


// return current time of the searched location
function getCurrentTime(){
	const {offset_sec} = JSON.parse(localStorage.getItem('geoData'))
	const time = new Date().getTime();
	const utcOffset = new Date().getTimezoneOffset() * 60000;
	const utcTime = time+utcOffset;
	const currentTime = new Date(utcTime+(offset_sec*1000))
	return currentTime;
}

showWeather()

function toggleDailyWeatherOpen(){
	if(!this.parentNode.classList.contains('open')){
		this.parentNode.classList.add('open')
	}else{
		this.nextElementSibling.firstElementChild.classList.remove('show')
	}
}

function getThreeHoursButtons(day, dayIdx){
	const buttons =  day.dataseries.map((data,idx)=>{
		const isNow = (dayIdx==0&&idx==0)
		const currentTime = new Date(data.timepoint)
		let hour = currentTime.getHours()
		const isAm = hour<12
		hour = hour>12?hour%12:hour;
		const isNight = data.weather.includes('night')
		let img = data.weather;
		['humid', 'lightrain', 'oshower', 'lightrain', 'ishower','lightsnow', 'rain', 'snow','rainsnow', 'ts', 'tsrain'].forEach(w=>{
			if(img.includes(w)){
				img = w;
			}
		})
		return (`
				<div data-dayidx=${dayIdx} data-currentidx=${idx} class="three-hourly-weather-button ${isNight && 'night'}">
					<p>${isNow?"Now":`${hour} ${isAm?'am':"pm"}`}</p>
					<div>
						<img src="./pngs/${img}.png" alt="">
					</div>
					<p>${data.temp2m}&deg</p>
				</div>
			`)
	});
	return buttons.join('')
}
function getWeatherInfoHTML(weather){
		const html = weather.map((day, dayIdx)=>{
		const threeHourlyButtons = getThreeHoursButtons(day, dayIdx);
		const [year, month, date] = [String(day.data.date).slice(0,4), Number(String(day.data.date).slice(4,6))-1, String(day.data.date).slice(6)]
		const time = new Date(year, month, date, null, null,null, null)
		let img = day.data.weather;
		if(!['humid', 'lightrain', 'oshower', 'lightrain', 'ishower','lightsnow', 'rain', 'snow','rainsnow', 'ts', 'tsrain'].some(w=>w==img)){
			img+="day";
		}

		return (`
					<div class="daily-weather-info ${dayIdx==0 && 'open'}">
						<div class="daily-weather-info-head">
							<div class="daily-weather-date">
								<p>${months[time.getMonth()]} ${time.getDate()}</p>
								<p>${weekdays[time.getDay()]}</p>
							</div>
		
							<div class="daily-weather-icon">
								<img src="./pngs/${img}.png">
								<p>${definitions.weather[day.data.weather+'day']}</p>
							</div>
							<div class="daily-weather-stats">
								<p>Temp: <span class="temp-max">${day.data.temp2m.max}&deg</span> <span class="temp-min">${day.data.temp2m.min}&deg</span></p>
								<p>Wind: ${definitions.wind10m[day.data.wind10m_max]}</p>
							</div>
							<i class="fas fa-chevron-down"></i>
						</div>
						<div class="daily-weather-info-div">
							<div class="weather-info">
							</div>
							<div class="three-hourly-weather-div">
							${threeHourlyButtons}
							</div>
						</div>
					</div>
					`)

	}).join("")
	return html;
}

function showWeatherInfo(el, weather){
	const {dayidx, currentidx} = el.dataset;
	const info = weather[dayidx].dataseries[currentidx];
	const time = new Date(info.timepoint)
	const isNow = dayidx == 0 && currentidx==0
	const isNight = info.weather.includes('night');
	let hours = time.getHours();
	const isAm = hours<12;
	hours = hours%12;
	let img = info.weather;
	['humid', 'lightrain', 'oshower', 'lightrain', 'ishower','lightsnow', 'rain', 'snow','rainsnow', 'ts', 'tsrain'].forEach(w=>{
		if(img.includes(w)){
			img=w;
		}
	})
	const html = `
		<div class="left">
			<p class="time">${isNow?"Now":`${hours} ${isAm?"am":'pm'}`}</p>
			<div class="weather">
				<p>???? Wind: ${info.wind10m.direction} ${definitions.wind10m[info.wind10m.speed]}</p>
				<p>???? Cloud Cover: ${definitions.cloudCover[info.cloudcover]}</p>
				<p>????  Humidity: ${info.rh2m}</p>
			</div>
		</div>
		<div class="right">
			<div class='weather-img'>
				<img src="./pngs/${img}.png">
			</div>
			<div class='desc'>
				<p><span class='low-opacity'>--/</span>${info.temp2m}&deg</p>
				<p>${definitions.weather[info.weather]}</p>
			</div>
		</div>
	`
	el.parentNode.previousElementSibling.innerHTML = html;
	if(isNow){
		el.parentNode.previousElementSibling.classList.add('show')
	}
	if(isNight){
		el.parentNode.previousElementSibling.classList.add('night')
	}else{
		el.parentNode.previousElementSibling.classList.remove('night')
	}
}

function showWeather(){
	
	const weather = normalizeWeather();
	if(weather){
		const geoData = JSON.parse(localStorage.getItem('geoData'))
		app.innerHTML = `<p id="location-info">${getLocationName(geoData.name)}</p>`
		const html = getWeatherInfoHTML(weather)
		app.innerHTML+=html;
		dailyWeatherHeads = app.querySelectorAll('.daily-weather-info-head')
		dailyWeatherHeads.forEach(el=>el.addEventListener('click', toggleDailyWeatherOpen))
		dailyWeatherHeads.forEach(head=>head.nextElementSibling.ontransitionend = function(){
			if(head.parentNode.classList.contains('open')){
				head.nextElementSibling.firstElementChild.classList.add('show')
			}
		})
		dailyWeatherHeads.forEach(head=>head.nextElementSibling.firstElementChild.ontransitionend = function(){
			if(!this.classList.contains('show')){
				head.parentNode.classList.remove('open')
			}
		})
		threeHourlyButtons = app.querySelectorAll('.three-hourly-weather-button')
		threeHourlyButtons.forEach(button=>button.onclick = function(){
			showWeatherInfo(this, weather);
		})
		
		dailyWeatherHeads.forEach(head=>{
			const button = head.nextElementSibling.querySelector('.three-hourly-weather-button');
			showWeatherInfo(button, weather);
		})
	}

}

// search by device location button is displayed when focused on input element
searchInput.addEventListener('focusin', ()=>{
	searchBar.classList.add('focused')
	
	// setting height and top property of location button
	useLocationButton.style.setProperty('width', searchBar.offsetWidth+"px");
	useLocationButton.style.setProperty("top", searchBar.offsetTop+searchBar.offsetHeight+"px");
})

searchForm.onsubmit = handleSearchSubmit;

document.onclick = (e)=>{
	if(e.target !== searchInput && e.target !== useLocationButton && searchBar.classList.contains('focused')){
		searchBar.classList.remove('focused')
	}
}
