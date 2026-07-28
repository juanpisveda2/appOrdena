#ifndef AppName
  #define AppName "Ordena"
#endif
#ifndef AppDescription
  #define AppDescription "Gestión de stock y ventas"
#endif
#ifndef AppPublisher
  #define AppPublisher "Ordena"
#endif
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef AppId
  #define AppId "com.ordena.desktop"
#endif
#ifndef ExeName
  #define ExeName "Ordena.exe"
#endif
#ifndef SourceDir
  #error SourceDir define is required.
#endif
#ifndef OutputDir
  #error OutputDir define is required.
#endif
#ifndef SetupBaseName
  #define SetupBaseName "Ordena-Setup"
#endif
#ifndef IconFile
  #error IconFile define is required.
#endif

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppComments={#AppDescription}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
OutputDir={#OutputDir}
OutputBaseFilename={#SetupBaseName}
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\{#ExeName}
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
CloseApplications=yes
CloseApplicationsFilter={#ExeName}
RestartApplications=no
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppDescription}
VersionInfoProductName={#AppName}
VersionInfoProductVersion={#AppVersion}
VersionInfoVersion={#AppVersion}
SetupLogging=yes
ChangesAssociations=no
ChangesEnvironment=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: checkedonce

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#ExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#ExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#ExeName}"; Tasks: desktopicon; WorkingDir: "{app}"; IconFilename: "{app}\{#ExeName}"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\{#ExeName}"; Description: "Ejecutar {#AppName}"; Flags: nowait postinstall skipifsilent
