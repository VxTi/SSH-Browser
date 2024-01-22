ARCHITECTURE=x64
PLATFORM=darwin
ARGUMENTS=--platform=$(PLATFORM) --arch=$(ARCHITECTURE)
NAME="SSH Browser"
SRC=.

# Building files
run:
	@echo "Cleaning $(NAME)..."
	@rm -rf build/$(NAME)-darwin-x64
	@rm -rf build/$(NAME)-darwin-x64.zip
	echo "Building $(NAME)..."
	electron-packager $(SRC) $(NAME) $(ARGUMENTS) --overwrite --out=build