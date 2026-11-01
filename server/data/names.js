// Name pools used to generate fictional domestic and associate-nation players.
import { pick } from '../util.js';

const P = (first, last) => ({ f: first.split(' '), l: last.split(' ') });
// Surnames with spaces use underscores here and are converted back after splitting.
const U = (s) => s.split(' ').map((x) => x.replace(/_/g, ' '));
const Q = (first, last) => ({ f: first.split(' '), l: U(last) });

const POOLS = {
  IN: Q('Aarav Vihaan Arjun Rohan Kabir Aditya Ishaan Rahul Karan Siddharth Manish Nikhil Pranav Tushar Yash Harsh Dev Ankit Sahil Varun Mayank Naman Rajat Shubh Tanmay Kunal Abhay Dhruv Jatin Lakshay Mohit Nitin Parth Raghav Sameer Tejas Uday Vivek Zaid',
    'Sharma Verma Patel Singh Yadav Reddy Nair Iyer Mehta Joshi Kulkarni Chauhan Gupta Das Kumar Rao Pandey Bhat Shetty Malhotra Thakur Desai Menon Saini Bhatia Chopra Dubey Gill Rawat Solanki Tiwari Naidu Pillai'),
  AU: Q('Jack Liam Noah Ethan Mason Lachlan Hayden Cooper Riley Archie Callum Mitch Flynn Harry Blake Ryan Cameron Jordan Tom Nate Zac Lachie Oscar Will Sam',
    'Smith Brown Wilson Taylor Anderson Clarke Walker Hughes Murray Fraser Mitchell Hayes Cooper Bennett Gibson Kelly Harris Thompson Reid Scott Wright Sutherland McKay Lawson'),
  EN: Q('Oliver George Harry Jack Charlie Thomas Freddie Alfie Oscar Archie Leo Max Toby Ben Joe Tom Ollie Dan Luke Josh Ed Matt Rob Will Jamie',
    'Taylor Davies Evans Roberts Wright Hall Clarke Turner Parker Harrison Fletcher Hughes Barnes Hopkins Bell Carter Ellis Foster Hart Hudson Marsh Pearce Rhodes Walsh'),
  ZA: Q('Pieter Johan Willem Jaco Dane Ruan Hennie Kobus Thabo Sipho Lwazi Jannie Wian Rudi Kagiso Themba Elton Stiaan Brandon Cobus',
    'van_der_Merwe Botha Pretorius Nel du_Plessis Mokoena Ndlovu Khumalo Steyn Jacobs Smit Venter Maseko Radebe Mthembu Kruger Joubert Naidoo Swanepoel'),
  NZ: Q('Hamish Jordan Finn Callum Tane Wiremu Cole Mitch Riki Nikau Hemi Kieran Tai Rawiri Aidan',
    'McKenzie Taylor Walker Henare Parata Wilson Murray Reid Cameron Stewart Ngata Williams Tuhiwai Moana Hohepa'),
  PK: Q('Ali Hamza Usman Bilal Zeeshan Hassan Arslan Faizan Imran Junaid Talha Shoaib Waqar Danish Kamran Haider Rehan Mubashir Tayyab Zubair Omar Salman Adnan Noman',
    'Khan Malik Ahmed Butt Chaudhry Qureshi Sheikh Raza Akhtar Siddiqui Mirza Afridi Baig Shah Ansari Javed Hussain Rana Gul Bhatti'),
  WI: Q('Kemar Jermaine Dwayne Shamar Tevin Raymon Kirk Nicolas Devon Jomel Alick Akeem Rahkeem Kavem Keon Jahmar Sheldon Marquino Terrance Odean',
    'Williams Joseph Bravo Thomas Edwards Phillip Gabriel Lewis Smith Roach Brathwaite Hinds Walsh Hodge Pierre Simmons Cottrell Jones Bonner Greaves'),
  SL: Q('Nuwan Lahiru Kasun Sadeera Thisara Charith Avishka Dinesh Chamika Binura Pavan Lakshan Sahan Janith Nimesh Shevon Ramesh Vijay Roshen Praveen',
    'Perera Fernando Silva Jayawardena Rajapaksa Gunathilaka Kumara Bandara Wickramasinghe Mendis Samarasinghe Dias Rathnayake Karunaratne Madushan Liyanage Gunasekara Weerasinghe'),
  BD: Q('Rakibul Tanvir Soumya Sabbir Imrul Anamul Liton Mosaddek Nayeem Jahid Ariful Rubel Zakir Parvez Saif Shahadat Hasan Afif Rony Fazle',
    'Hossain Islam Rahman Ahmed Hasan Chowdhury Sarkar Mondal Khan Mahmud Siddique Alam Biswas Mia Haque Sheikh'),
  AF: Q('Rahmat Karim Waqar Sediqullah Darwish Qais Zia Abdul Fareed Shams Bilal Hazratullah Mujib Rashid Naveed Noor Samiullah Safiullah Yamin Sharafuddin',
    'Zadran Ahmadzai Khan Rahimi Omari Noori Sherzad Safi Karimi Stanikzai Mangal Azizi Hotak'),
  IE: Q('Conor Sean Cian Darragh Niall Rory Fionn Eoin Cathal Oisin Ciaran Dara Liam Padraig Tadhg',
    "Murphy O'Brien Kelly Walsh Ryan Doyle Byrne McCarthy Gallagher Dunne Quinn Kavanagh Brennan Nolan Flynn"),
  SC: Q('Angus Fraser Callum Hamish Ewan Rory Euan Lewis Craig Murray Alasdair Calum Gregor Iain Struan',
    'MacDonald Campbell Stewart Robertson Murray Ross Fraser Cameron Graham Munro Gordon Sinclair Grant Reid Duncan'),
  ZW: Q('Tendai Tafadzwa Takudzwa Kudzai Tinashe Blessing Tanaka Brian Wellington Prosper Tapiwa Innocent Ryan Luke Ngoni Simba',
    'Moyo Ncube Dube Chigumbura Sibanda Mutasa Ndlovu Mushore Chari Madande Mudzinganyama Muzhange Tshuma Mavuta'),
  NL: Q('Jan Pieter Daan Sem Lars Bram Thijs Ruben Max Niels Sander Tim Joost Wesley Floris Teun Stijn',
    'de_Vries Jansen Bakker Visser Smit Meijer Mulder Bos Vos Peters van_Dijk Kuijpers Dekker Hoekstra Brouwer Kramer'),
  NP: Q('Rohit Kushal Dipendra Aasif Sompal Lokesh Karan Bhim Gulshan Arjun Kishore Anil Pratis Binod Sundeep Basant Aarif Abinash',
    'Shrestha Thapa Bhurtel Malla Karki Gurung Airee Sheikh Paudel Kami Mahato Bohara Khadka Rana Dhakal Budha Tamang'),
  NA: Q('Zane Gerhard Jan Ruben Nicol Tangeni Bernard Pikky Michau Dylan Louren Jack Karl Stephan Max',
    'Green Erasmus Frylinck Trumpelmann Loftie-Eaton Scholtz van_Lingen Smit Baard Kruger Burger France Lungameni Snyman'),
  OM: Q('Aqib Zeeshan Kashyap Jatinder Khalid Naseem Bilal Fayyaz Mehran Shoaib Sufyan Ayaan Kaleemullah Jay Nestor Rafiullah Adil',
    'Ilyas Maqsood Prajapati Singh Al_Balushi Khushi Khan Butt Mehmood Ali Kumar Al_Shukaili Al_Kindi Mukaddam'),
  AE: Q('Muhammad Waseem Vriitya Alishan Aryan Basil Zawar Junaid Ethan Rohan Zahoor Karthik Asif Ahmed Sharafu Aayan Haider Omid',
    "Waseem Aravind Sharafu Lakra Hameed Farid Siddique D'Souza Mustafa Khan Raza Ali Meiyappan Zuhaib Afzal Ahmad Rafique"),
  US: Q('Tyler Jason Aaron Corey Brian Monank Saurabh Nisarg Steven Shayan Milind Jaskaran Andries Harmeet Ayan Nosthush Shubham Sanjay Ali Usman Hunter Jessy',
    'Patel Jones Taylor Netravalkar Kumar Singh Jahangir Kenjige Ranjane Gous Johnson Stevens Moore Harris Desai Ahmed'),
  CA: Q('Nicholas Navneet Aaron Harsh Saad Pargat Rishiv Ravinderpal Shreyas Dilon Kaleem Jeremy Jaskaran Daniel Parth Ayaan Rayyankhan Nikhil Smit Dilpreet',
    'Kirton Dhaliwal Johnson Thaker Bin_Zafar Singh Joshi Movva Heyliger Sana Gordon Patel Hansra Dutta Ahmadzai Sharma Bajwa Pathan Khan'),
};

const WOMEN = {
  IN: 'Ananya Diya Meera Priya Riya Sanya Isha Kavya Tanvi Neha Pooja Shruti Aditi Nisha Simran Trisha Kritika Vaishnavi Mansi Radhika Sneha Jhanvi Kirti Pallavi'.split(' '),
  EN: 'Emily Charlotte Amelia Grace Lucy Ella Chloe Sophie Holly Isla Mia Ruby Hannah Eva Lily Jessica Georgia Abigail Phoebe Maddie Tilly Imogen Freya Ellie Zoe'.split(' '),
  PK: 'Ayesha Fatima Sana Hira Maryam Zainab Iqra Amna Nimra Rabia Saba Laiba Mahnoor'.split(' '),
  SL: 'Nilakshi Hasini Shashikala Anushka Imesha Sachini Dulani Udari Piumi Achini Malsha Vishmi'.split(' '),
  BD: 'Nigar Fargana Jahanara Ritu Shamima Sobhana Lata Rumana Salma Shorna Murshida Fariha'.split(' '),
};

const COUNTRY_POOL = {
  IND: 'IN', AUS: 'AU', ENG: 'EN', RSA: 'ZA', NZ: 'NZ', PAK: 'PK', WI: 'WI', SL: 'SL', BAN: 'BD', AFG: 'AF', IRE: 'IE', ZIM: 'ZW',
  NED: 'NL', SCO: 'SC', USA: 'US', CAN: 'CA', UAE: 'AE', NEP: 'NP', OMA: 'OM', NAM: 'NA',
};
const WOMEN_POOL = { IN: 'IN', NP: 'IN', PK: 'PK', AF: 'PK', AE: 'PK', OM: 'PK', SL: 'SL', BD: 'BD' };

const used = new Set();
export function reserveName(n) { used.add(n); }

export function genName(rng, country, women) {
  const pool = POOLS[COUNTRY_POOL[country] || 'EN'];
  const key = COUNTRY_POOL[country] || 'EN';
  const firsts = women ? WOMEN[WOMEN_POOL[key] || 'EN'] : pool.f;
  for (let i = 0; i < 40; i++) {
    const n = `${pick(rng, firsts)} ${pick(rng, pool.l)}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
  const letter = String.fromCharCode(65 + Math.floor(rng() * 26));
  const n = `${pick(rng, firsts)} ${letter}. ${pick(rng, pool.l)}`;
  used.add(n);
  return n;
}

export const SOUTH_ASIAN = new Set(['IND', 'PAK', 'SL', 'BAN', 'AFG', 'UAE', 'NEP', 'OMA']);
