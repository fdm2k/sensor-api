#!/usr/bin/python
import os
import fnmatch
import time
import sys
import sqlite3
import datetime

# Setup variables
# ---------------
# setup where we'll store the temperature data
dbfile = '/home/pi/sensor-api/data/cellar_temps.db'
rowcount = 1

# Function to grab all sensors and add to an array
base_dir = '/sys/bus/w1/devices/'
w1_file = '/w1_slave'
def_sensor_name = 'UNDEFINED_'
timeseries = datetime.datetime.now()

# setup dictionary of sensor friendly names
dict = {
	'28-0000056c22db': 'Ambient',
	'28-00000540fd47': 'Carton: Lower',
	'28-000005506894': 'Carton: Upper'
};

# Define the function for updating the DB
def add_temp_reading(timeseries, sensor_id, sensor_name, temp_c, temp_f):
	# First make sure the db file exists
	if not os.path.isfile(dbfile):
		file = open(dbfile,"w")

	# Setup the sqlite connection and DB
	conn=sqlite3.connect(dbfile)
	curs=conn.cursor()

	# first check if the table has been setup
	curs.execute("CREATE TABLE IF NOT EXISTS temps (data_id INTEGER PRIMARY KEY, datetime DATETIME, sensor_id STRING, sensor_name STRING, temp_c FLOAT, temp_f FLOAT)")

	# insert the latest sensor readings based on what's passed to the function
	curs.execute("""INSERT INTO temps(datetime,sensor_id,sensor_name,temp_c,temp_f) VALUES((?), (?), (?), (?), (?))""", (timeseries, sensor_id, sensor_name, temp_c, temp_f))

	# commit the changes
	conn.commit()

	# close the connection
	conn.close()

# Open the raw w1 file, suck in its content and return it for use later
def read_temp_raw():
	f = open(base_dir + filename + w1_file, 'r')
	lines = f.readlines()
	f.close()
	return lines

# From the raw w1 file contents, return the C and F temps of the sensor
def read_temp():
	lines = read_temp_raw()
	while lines[0].strip()[-3:] != 'YES':
		time.sleep(0.1)
		lines = read_temp_raw()
	equals_pos = lines[1].find('t=')
	if equals_pos != -1:
		temp_string = lines[1][equals_pos+2:]
		temp_c = float(temp_string) / 1000.0
		temp_f = temp_c * 9.0 / 5.0 + 32.0
	return temp_c, temp_f

# Main program code
# -------------------
# Make sure GPIO and w1-therm have been probed
os.system('modprobe wire')
os.system('modprobe w1-gpio')
os.system('modprobe w1-therm')

# Declare 'for loop' variables
i = 0

# loop through the sensor files and record their readings
for filename in os.listdir(base_dir):
	if fnmatch.fnmatch(filename, '28-*'):
		deg_c, deg_f = read_temp()
		# check if we know the sensor or not - has it been defined?
		if filename in dict:
			sensor_name = str(dict[filename])
		else:
			# must be new, so assign it a default name
			sensor_name = def_sensor_name + str(i)

		print "{\n datetime: %s;\n sensor_id: %s;\n sensor_name: %s;\n temp_c: %0.1fC;\n temp_f: %0.1fF\n}," % (timeseries, filename, sensor_name, deg_c, deg_f)

		# Add the temp reading to the database
		add_temp_reading(timeseries, filename, sensor_name, deg_c, deg_f)
		i += 1

# Hopefully everything has been written in successfully!
