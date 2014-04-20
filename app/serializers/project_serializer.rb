class ProjectSerializer < ActiveModel::Serializer
	attributes :title, :description, :git, :link, :id, :image, :image_thumb, :image_medium, :tags
	has_many :tags

	def image_thumb
		object.image.url(:thumb)
	end

	def image_medium
		object.image.url(:medium)
	end


end