import pandas as pd

# Load the Excel file
file_path = '/Users/minjikim/GitHub/JODH/ver.2/(0711,ver.2)final_rawdata_nannfilled.xlsx'  # Update this path
df = pd.read_excel(file_path, engine='openpyxl')

# Ensure all relevant columns are treated as strings
df = df.astype(str)

# Replace 'nan' with an empty string
df.replace('nan', '', inplace=True)

# Convert BirthYear, DeathYear, and SongNo to strings without '.0'
df['CBirthYear'] = df['CBirthYear'].apply(lambda x: x.replace('.0',''))
df['CDeathYear'] = df['CDeathYear'].apply(lambda x: x.replace('.0',''))
df['SongNo'] = df['SongNo'].apply(lambda x: x.replace('.0',''))

# Prepare a dictionary to hold the markdown content for each Identifier
program_dict = {}

# Helper function to format the Composer information
def format_composer_info(row):
    # Handle special cases
    if row['SongTitle'].lower() == 'intermission':
        return '#### Intermission', ''
    
    # Handle BirthYear and DeathYear
    if row['CBirthYear'] and row['CDeathYear']:
        composer_info = f"#### {row['Composer']} ({row['CBirthYear']}-{row['CDeathYear']})"
    else:
        composer_info = f"#### {row['Composer']}"
    
    # Handle SongCycle and Opus/Catalogue 번호
    if row['SongCycle'] and row['Opus/Catalogue 번호']:
        song_info = f"{row['SongCycle']}, {row['Opus/Catalogue 번호']} : {row['SongNo']}. {row['SongTitle']}"
    elif row['Opus/Catalogue 번호'] and not row['SongCycle']:
        song_info = f"{row['Opus/Catalogue 번호']} : {row['SongNo']}. {row['SongTitle']}".replace(',', '').replace('.', '')
    elif row['SongCycle']:
        song_info = f"{row['SongCycle']} : {row['SongNo']}. {row['SongTitle']}".replace(': .', '').replace(':', '').replace(',', '')
    else:
        song_info = f"{row['SongTitle']}"
    
    # if row['Translated']:
    #     song_info += f" ({row['Translated']})"
    
    # if row['FromOpera']:
    #     song_info += f"\n_From Opera, {row['FromOpera']}_"
    # elif row['FromOratorio']:
    #     song_info += f"\n_From Oratorio, {row['FromOratorio']}_"
    # elif row['FromCantata']:
    #     song_info += f"\n_From Cantata {row['FromCantata']}_"
    
    return composer_info.strip(', :.'), song_info.strip(', :.')

# Iterate through the rows and build the program content
for idx, row in df.iterrows():
    identifier = row['Identifier']
    composer_info, song_info = format_composer_info(row)
    
    if identifier not in program_dict:
        program_dict[identifier] = []
    
    # Add a newline before a new composer appears
    if not program_dict[identifier] or program_dict[identifier][-1][0] != composer_info:
        if program_dict[identifier]:
            program_dict[identifier].append(("\n", []))  # Add a newline before new composer
        program_dict[identifier].append((composer_info, [song_info]))
    else:
        program_dict[identifier][-1][1].append(song_info)

# Prepare data for the new DataFrame
data = {'Identifier': [], 'Program': []}

for identifier in sorted(program_dict.keys(), key=int, reverse=True):
    program_lines = []
    for composer_info, songs in program_dict[identifier]:
        if composer_info.strip():
            if program_lines:  # Add newline only if it's not the first composer
                program_lines.append("")
            program_lines.append(composer_info)
        program_lines.extend(songs)
    program = "\n".join(program_lines)
    data['Identifier'].append(identifier)
    data['Program'].append(program)

# Create a new DataFrame
program_df = pd.DataFrame(data)

# Save the new DataFrame to an Excel file
excel_file_path = '/Users/minjikim/GitHub/JODH/ver.2/(0711)programs.xlsx'  # Update this path
program_df.to_excel(excel_file_path, index=False)

print(f"Excel file saved to {excel_file_path}")
