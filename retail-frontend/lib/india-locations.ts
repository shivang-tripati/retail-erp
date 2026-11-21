export const indianStates=[
  'Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh',
  'Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra',
  'Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu',
  'Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'
] as const

export const citiesByState:Record<string,string[]>={
  'Andhra Pradesh':['Amaravati','Anantapur','Chittoor','Guntur','Kakinada','Kadapa','Kurnool','Nellore','Rajahmundry','Tirupati','Vijayawada','Visakhapatnam'],
  'Arunachal Pradesh':['Itanagar','Pasighat','Tawang','Ziro'],
  Assam:['Bongaigaon','Dibrugarh','Guwahati','Jorhat','Silchar','Tezpur'],
  Bihar:['Bhagalpur','Darbhanga','Gaya','Muzaffarpur','Patna','Purnia'],
  Chandigarh:['Chandigarh'],
  Chhattisgarh:['Bhilai','Bilaspur','Durg','Raipur','Rajnandgaon'],
  'Dadra and Nagar Haveli and Daman and Diu':['Daman','Diu','Silvassa'],
  Delhi:['Central Delhi','East Delhi','New Delhi','North Delhi','North West Delhi','South Delhi','South West Delhi','West Delhi'],
  Goa:['Margao','Panaji','Mapusa','Vasco da Gama'],
  Gujarat:['Ahmedabad','Bhavnagar','Gandhinagar','Jamnagar','Junagadh','Rajkot','Surat','Vadodara'],
  Haryana:['Ambala','Faridabad','Gurugram','Hisar','Karnal','Panchkula','Panipat','Rohtak','Sonipat','Yamunanagar'],
  'Himachal Pradesh':['Baddi','Kullu','Manali','Shimla','Solan'],
  'Jammu and Kashmir':['Jammu','Srinagar'],
  Jharkhand:['Bokaro','Dhanbad','Jamshedpur','Ranchi'],
  Karnataka:['Belagavi','Bengaluru','Hubballi','Mangaluru','Mysuru','Shivamogga','Tumakuru'],
  Kerala:['Ernakulam','Kochi','Kollam','Kozhikode','Thiruvananthapuram','Thrissur'],
  Ladakh:['Leh','Kargil'],
  Lakshadweep:['Kavaratti'],
  'Madhya Pradesh':['Bhopal','Gwalior','Indore','Jabalpur','Ratlam','Ujjain'],
  Maharashtra:['Aurangabad','Mumbai','Nagpur','Nashik','Navi Mumbai','Pune','Thane'],
  Manipur:['Imphal'],
  Meghalaya:['Shillong'],
  Mizoram:['Aizawl'],
  Nagaland:['Dimapur','Kohima'],
  Odisha:['Bhubaneswar','Cuttack','Puri','Rourkela','Sambalpur'],
  Puducherry:['Puducherry','Karaikal'],
  Punjab:['Amritsar','Bathinda','Jalandhar','Ludhiana','Mohali','Patiala'],
  Rajasthan:['Ajmer','Bikaner','Jaipur','Jodhpur','Kota','Udaipur'],
  Sikkim:['Gangtok'],
  'Tamil Nadu':['Chennai','Coimbatore','Madurai','Salem','Thanjavur','Tiruchirappalli','Vellore'],
  Telangana:['Hyderabad','Karimnagar','Khammam','Nizamabad','Secunderabad','Warangal'],
  Tripura:['Agartala'],
  'Uttar Pradesh':['Agra','Aligarh','Allahabad','Bareilly','Ghaziabad','Gorakhpur','Greater Noida','Kanpur','Lucknow','Meerut','Noida','Prayagraj','Varanasi'],
  Uttarakhand:['Dehradun','Haridwar','Nainital','Roorkee','Rishikesh'],
  'West Bengal':['Asansol','Durgapur','Howrah','Kolkata','Siliguri'],
  'Andaman and Nicobar Islands':['Port Blair']
}

export function citiesForState(state:string){
  return [...(citiesByState[state]||[])].sort((a,b)=>a.localeCompare(b))
}
