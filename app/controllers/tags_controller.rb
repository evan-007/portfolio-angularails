class TagsController < ApplicationController
	before_action :authenticate_user!
	before_action :set_tag, only: [:show, :edit, :update, :destroy]

	def index
	end

	def new
		@tag = Tag.new
	end

	def create
		@tag = Tag.new(tag_params)
		if @tag.save
			flash[:notice] = "Successfully created..."
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
			redirect_to admin_path
		end
	end

	def show
	end

	def edit
	end

	def update
		if @tag.update(tag_params)
			flash[:notice] = "Successfully updated"
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
			redirect_to admin_path
		end
	end

	def destroy
		if @tag.destroy
			flash[:notice] = "Boom!"
			redirect_to admin_path
		else
			flash[:notice] = "uhoh"
			redirect_to admin_path
		end
	end

	private
	  def set_tag
	  	@tag = Tag.find(params[:id])
	  end

	  def tag_params
	  	params.require(:tag).permit(:avatar, :name)
	  end
end
